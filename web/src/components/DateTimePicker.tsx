import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A custom date + time picker that looks and behaves identically on web and
 * mobile (no native datetime-local, which renders differently per platform).
 *
 * - Opens defaulted to *now* (today's date + the current time, 12-hour).
 * - Past dates are disabled, and on today you can't pick a time already gone.
 * - Click the field to open; pick a day + hour/minute (AM/PM).
 * - Clicking outside closes it (the value commits as you pick).
 * - Emits a wall-clock string "YYYY-MM-DDTHH:mm" (24h, no timezone), the same
 *   format the native input produced.
 */
type Props = {
  value: string; // "YYYY-MM-DDTHH:mm" or ""
  onChange: (v: string) => void;
  required?: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function parse(value: string) {
  if (value && value.length >= 16) {
    const [d, t] = value.split("T");
    const [y, mo, da] = d.split("-").map(Number);
    const [h, mi] = t.split(":").map(Number);
    if (y && mo && da) return { day: new Date(y, mo - 1, da), hour: h, minute: mi };
  }
  return { day: null as Date | null, hour: null as number | null, minute: null as number | null };
}

// 24h → 12h parts and back.
const to12 = (h: number) => ({ h12: ((h + 11) % 12) + 1, ampm: h < 12 ? "AM" : "PM" });
const to24 = (h12: number, ampm: string) => (ampm === "AM" ? h12 % 12 : (h12 % 12) + 12);

function fmtDisplay(value: string): string {
  const { day, hour, minute } = parse(value);
  if (!day || hour == null || minute == null) return "";
  const { h12, ampm } = to12(hour);
  return `${WEEKDAYS[day.getDay()]} ${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear()}, ${h12}:${pad(minute)} ${ampm}`;
}

export default function DateTimePicker({ value, onChange, required }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parse(value), [value]);
  const [view, setView] = useState<Date>(parsed.day ?? new Date());

  // Open → if empty, default to today + the current time; jump view to selection.
  useEffect(() => {
    if (!open) return;
    if (parsed.day) {
      setView(parsed.day);
    } else {
      const now = new Date();
      setView(now);
      commit(startOfDay(now), now.getHours(), now.getMinutes());
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Commit, clamping a past time on "today" up to the current time so you can
  // never schedule something already gone.
  const commit = (day: Date, hour: number, minute: number) => {
    const now = new Date();
    let h = hour;
    let mi = minute;
    if (day.getTime() === startOfDay(now).getTime()) {
      const picked = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, mi);
      if (picked < now) {
        h = now.getHours();
        mi = now.getMinutes();
      }
    }
    onChange(`${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(h)}:${pad(mi)}`);
  };

  const curHour = parsed.hour ?? new Date().getHours();
  const curMin = parsed.minute ?? new Date().getMinutes();
  const { h12, ampm } = to12(curHour);

  const pickDay = (day: Date) => commit(day, curHour, curMin);
  const pickTime = (hour: number, minute: number) => commit(parsed.day ?? startOfDay(new Date()), hour, minute);

  const today = startOfDay(new Date());
  const grid = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const start = first.getDay();
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < start; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d));
    return cells;
  }, [view]);

  const sameDay = (a: Date | null, b: Date | null) =>
    !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const isPast = (d: Date) => startOfDay(d).getTime() < today.getTime();
  // When today is selected, hours before the current hour are gone.
  const selDayIsToday = sameDay(parsed.day, today);
  const nowH = new Date().getHours();
  const nowM = new Date().getMinutes();
  // Don't let the user page to a month entirely in the past.
  const atCurrentMonth = view.getFullYear() === today.getFullYear() && view.getMonth() === today.getMonth();

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
      {required && (
        <input tabIndex={-1} aria-hidden className="pointer-events-none absolute h-0 w-0 opacity-0" value={value} required onChange={() => {}} />
      )}

      {open && (
        <div
          className="absolute z-40 mt-1 w-[18rem] max-w-[calc(100vw-2rem)] rounded-xl border p-3 shadow-lg"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="btn-ghost px-2 py-1 text-sm disabled:opacity-30"
              disabled={atCurrentMonth}
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
            >‹</button>
            <span className="text-sm font-bold">{MONTHS[view.getMonth()]} {view.getFullYear()}</span>
            <button type="button" className="btn-ghost px-2 py-1 text-sm"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>›</button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold muted">
            {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {grid.map((d, i) =>
              d ? (
                <button
                  key={i}
                  type="button"
                  disabled={isPast(d)}
                  onClick={() => pickDay(d)}
                  className={`grid h-8 place-items-center rounded-lg text-sm transition ${
                    isPast(d)
                      ? "cursor-not-allowed opacity-30"
                      : sameDay(d, parsed.day)
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

          {/* Time — 12-hour with AM/PM. Label on its own line so each box is
              wide enough to show its value (e.g. "10 : 23 PM"). */}
          <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
            <span className="mb-1 block text-xs font-semibold muted">Time</span>
            <div className="flex items-center gap-2">
              <select
                className="input w-16 px-2 py-1 text-center"
                value={h12}
                onChange={(e) => pickTime(to24(Number(e.target.value), ampm), curMin)}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((hh) => {
                  const h24 = to24(hh, ampm);
                  const gone = selDayIsToday && h24 < nowH;
                  return <option key={hh} value={hh} disabled={gone}>{hh}</option>;
                })}
              </select>
              <span className="font-bold">:</span>
              <select
                className="input w-16 px-2 py-1 text-center"
                value={curMin}
                onChange={(e) => pickTime(curHour, Number(e.target.value))}
              >
                {Array.from({ length: 60 }, (_, m) => m).map((m) => {
                  const gone = selDayIsToday && (curHour < nowH || (curHour === nowH && m < nowM));
                  return <option key={m} value={m} disabled={gone}>{pad(m)}</option>;
                })}
              </select>
              <select
                className="input w-20 px-2 py-1 text-center"
                value={ampm}
                onChange={(e) => pickTime(to24(h12, e.target.value), curMin)}
              >
                {["AM", "PM"].map((ap) => {
                  // For today, disable AM if the whole morning has passed.
                  const gone = selDayIsToday && ap === "AM" && nowH >= 12;
                  return <option key={ap} value={ap} disabled={gone}>{ap}</option>;
                })}
              </select>
            </div>
          </div>

          <button type="button" className="btn-primary mt-3 w-full py-1.5 text-sm" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}
