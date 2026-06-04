import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { tap } from "@/lib/haptics";
import { useTheme } from "@/theme";

/**
 * Date + time picker that behaves like the web one: opens defaulted to *now*
 * (12-hour), past dates/times disabled, and emits a wall-clock string
 * "YYYY-MM-DDTHH:mm" (24h, no timezone) — identical contract to web.
 */
type Props = { value: string; onChange: (v: string) => void; placeholder?: string };

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
const to12 = (h: number) => ({ h12: ((h + 11) % 12) + 1, ampm: h < 12 ? "AM" : "PM" });
const to24 = (h12: number, ampm: string) => (ampm === "AM" ? h12 % 12 : (h12 % 12) + 12);
const sameDay = (a: Date | null, b: Date | null) =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function fmtDisplay(value: string): string {
  const { day, hour, minute } = parse(value);
  if (!day || hour == null || minute == null) return "";
  const { h12, ampm } = to12(hour);
  return `${WEEKDAYS[day.getDay()]} ${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear()}, ${h12}:${pad(minute)} ${ampm}`;
}

export default function DateTimePicker({ value, onChange, placeholder = "Pick date & time" }: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parse(value), [value]);
  const [view, setView] = useState<Date>(parsed.day ?? new Date());

  const today = startOfDay(new Date());
  const now = new Date();

  const openPicker = () => {
    setOpen(true);
    if (parsed.day) setView(parsed.day);
    else {
      setView(now);
      commit(startOfDay(now), now.getHours(), now.getMinutes());
    }
  };

  // Commit, clamping a past time on "today" up to the current time.
  const commit = (day: Date, hour: number, minute: number) => {
    const n = new Date();
    let h = hour, mi = minute;
    if (day.getTime() === startOfDay(n).getTime()) {
      const picked = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, mi);
      if (picked < n) { h = n.getHours(); mi = n.getMinutes(); }
    }
    onChange(`${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(h)}:${pad(mi)}`);
  };

  const curHour = parsed.hour ?? now.getHours();
  const curMin = parsed.minute ?? now.getMinutes();
  const { h12, ampm } = to12(curHour);

  const pickDay = (day: Date) => commit(day, curHour, curMin);
  const pickTime = (hour: number, minute: number) => commit(parsed.day ?? startOfDay(new Date()), hour, minute);

  const grid = useMemo(() => {
    const start = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < start; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d));
    return cells;
  }, [view]);

  const isPast = (d: Date) => startOfDay(d).getTime() < today.getTime();
  const atCurrentMonth = view.getFullYear() === today.getFullYear() && view.getMonth() === today.getMonth();

  const chip = (selected: boolean, disabled: boolean) => ({
    backgroundColor: selected ? t.primary : t.surface,
    borderColor: selected ? t.primary : t.border,
    borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12,
    marginRight: 6, opacity: disabled ? 0.3 : 1,
  });

  return (
    <View>
      <Pressable
        onPress={openPicker}
        style={{ backgroundColor: t.bg, borderColor: t.border, borderWidth: 1, borderRadius: 10, padding: 11, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
      >
        <Text style={{ color: value ? t.text : t.muted }}>{value ? fmtDisplay(value) : placeholder}</Text>
        <Text style={{ color: t.muted }}>📅</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }} onPress={() => setOpen(false)}>
          <Pressable style={{ backgroundColor: t.surface, borderRadius: 16, padding: 16 }} onPress={() => {}}>
            {/* Month nav */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Pressable disabled={atCurrentMonth} onPress={() => { tap(); setView(new Date(view.getFullYear(), view.getMonth() - 1, 1)); }}>
                <Text style={{ color: atCurrentMonth ? t.muted : t.primary, fontSize: 22, opacity: atCurrentMonth ? 0.3 : 1, paddingHorizontal: 8 }}>‹</Text>
              </Pressable>
              <Text style={{ color: t.text, fontWeight: "800" }}>{MONTHS[view.getMonth()]} {view.getFullYear()}</Text>
              <Pressable onPress={() => { tap(); setView(new Date(view.getFullYear(), view.getMonth() + 1, 1)); }}>
                <Text style={{ color: t.primary, fontSize: 22, paddingHorizontal: 8 }}>›</Text>
              </Pressable>
            </View>

            {/* Weekday header */}
            <View style={{ flexDirection: "row" }}>
              {WEEKDAYS.map((w) => (
                <Text key={w} style={{ flex: 1, textAlign: "center", color: t.muted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>{w}</Text>
              ))}
            </View>

            {/* Day grid */}
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {grid.map((d, i) => {
                if (!d) return <View key={i} style={{ width: `${100 / 7}%`, height: 38 }} />;
                const past = isPast(d);
                const sel = sameDay(d, parsed.day);
                const isToday = sameDay(d, today);
                return (
                  <Pressable key={i} disabled={past} onPress={() => { tap(); pickDay(d); }}
                    style={{ width: `${100 / 7}%`, height: 38, alignItems: "center", justifyContent: "center" }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: sel ? t.primary : "transparent" }}>
                      <Text style={{ color: past ? t.muted : sel ? "#fff" : isToday ? t.primary : t.text, opacity: past ? 0.3 : 1, fontWeight: sel || isToday ? "800" : "500" }}>
                        {d.getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Time — 12-hour with AM/PM */}
            <View style={{ borderTopColor: t.border, borderTopWidth: 1, marginTop: 10, paddingTop: 10 }}>
              {/* Any hour/minute is selectable; a past time on *today* is clamped
                  up to the current time on commit, so future edits are never blocked. */}
              <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>Hour</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((hh) => (
                  <Pressable key={hh} onPress={() => { tap(); pickTime(to24(hh, ampm), curMin); }} style={chip(hh === h12, false)}>
                    <Text style={{ color: hh === h12 ? "#fff" : t.text }}>{hh}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>Minute</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {Array.from({ length: 60 }, (_, m) => m).map((m) => (
                  <Pressable key={m} onPress={() => { tap(); pickTime(curHour, m); }} style={chip(m === curMin, false)}>
                    <Text style={{ color: m === curMin ? "#fff" : t.text }}>{pad(m)}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={{ flexDirection: "row" }}>
                {["AM", "PM"].map((ap) => (
                  <Pressable key={ap} onPress={() => { tap(); pickTime(to24(h12, ap), curMin); }} style={chip(ap === ampm, false)}>
                    <Text style={{ color: ap === ampm ? "#fff" : t.text }}>{ap}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable onPress={() => setOpen(false)} style={{ backgroundColor: t.primary, borderRadius: 10, padding: 11, alignItems: "center", marginTop: 12 }}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
