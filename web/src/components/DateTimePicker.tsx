import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A custom date + time picker that looks and behaves identically on web and
 * mobile (no native datetime-local, which renders differently per platform).
 *
 * - Click the field to open a calendar popover; pick a day + hour/minute.
 * - Clicking outside the popover closes it (the value is already committed as
 *   you pick, so "click away to save" works).
 * - Emits a wall-clock string "YYYY-MM-DDTHH:mm" (no timezone conversion), the
 *   same format the native input produced.
 */
type Props = {
  value: string; // "YYYY-MM-DDTHH:mm" or ""
  onChange: (v: string) => void;
  required?: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parse(value: string) {
  if (value && value.length >= 16) {
    const [d, t] = value.split("T");
    const [y, mo, da] = d.split("-").map(Number);
    const [h, mi] = t.split(":").map(Number);
    if (y && mo && da) return { day: new Date(y, mo - 1, da), hour: h, minute: mi };
  }
  return { day: null as Date | null, hour: 11, minute: 0 };
}

function fmtDisplay(value: string): string {
  const { day, hour, minute } = parse(value);
  if (!day) return "";
  return `${WEEKDAYS[day.getDay()]} ${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear()}, ${pad(hour)}:${pad(minute)}`;
}

export default function DateTimePicker({ value, onChange, required }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parse(value), [value]);
  // Month currently shown in the grid (defaults to the selected day / today).
  const [view, setView] = useState<Date>(parsed.day ?? new Date());

  useEffect(() => {
    if (open && parsed.day) setView(parsed.day);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close when clicking/tapping outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const commit = (day: Date, hour: number, minute: number) => {
    onChange(`${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(hour)}:${pad(minute)}`);
  };

  const pickDay = (day: Date) => commit(day, parsed.hour, parsed.minute);
  const pickTime = (hour: number, minute: number) => {
    const day = parsed.day ?? new Date();
    commit(day, hour, minute);
  };

  // Build the calendar grid for the viewed month.
  const grid = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const start = first.getDay(); // leading blanks
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < start; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d));
    return cells;
  }, [view]);

  const today = new Date();
  const sameDay = (a: Date | null, b: Date | null) =>
    !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  return (
    <div className="relative" ref={wrap}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`input flex items-center justify-between text-left ${value ? "" : "text-[var(--muted)]"}`}
      >
        <span className="truncate">{value ? fmtDisplay(value) : "Pick date & time"}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 shrink-0">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>
      {/* keep form validation working when required */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          value={value}
          required
          onChange={() => {}}
        />
      )}

      {open && (
        <div
          className="absolute z-40 mt-1 w-[18rem] max-w-[calc(100vw-2rem)] rounded-xl border p-3 shadow-lg"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {/* Month header */}
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="btn-ghost px-2 py-1 text-sm"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>‹</button>
            <span className="text-sm font-bold">{MONTHS[view.getMonth()]} {view.getFullYear()}</span>
            <button type="button" className="btn-ghost px-2 py-1 text-sm"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>›</button>
          </div>

          {/* Weekday labels */}
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold muted">
            {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {grid.map((d, i) =>
              d ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickDay(d)}
                  className={`grid h-8 place-items-center rounded-lg text-sm transition ${
                    sameDay(d, parsed.day)
                      ? "bg-pitch-500 font-bold text-white"
                      : sameDay(d, today)
                        ? "font-bold text-pitch-600"
                        : "hover:bg-pitch-500/10"
                  }`}
                >
                  {d.getDate()}
                </button>
              ) : (
                <span key={i} />
              ),
            )}
          </div>

          {/* Time */}
          <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs font-semibold muted">Time</span>
            <select
              className="input flex-1 py-1"
              value={parsed.hour}
              onChange={(e) => pickTime(Number(e.target.value), parsed.minute)}
            >
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{pad(h)}</option>)}
            </select>
            <span className="font-bold">:</span>
            <select
              className="input flex-1 py-1"
              value={parsed.minute}
              onChange={(e) => pickTime(parsed.hour, Number(e.target.value))}
            >
              {Array.from({ length: 60 }, (_, m) => <option key={m} value={m}>{pad(m)}</option>)}
            </select>
          </div>

          <button type="button" className="btn-primary mt-3 w-full py-1.5 text-sm" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}
