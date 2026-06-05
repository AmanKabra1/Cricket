import { ScrollView, Text, View } from "react-native";
import Svg, { Circle, G, Line, Polygon, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { palette, useTheme } from "@/theme";
import type { OverPoint } from "@/types";

const H = 160;
const PAD_TOP = 20;
const PAD_BOTTOM = 22;
const COL = 44;

/** Manhattan — runs per over as labelled bars (red = a wicket fell that over). */
export function Manhattan({ overs }: { overs: OverPoint[] }) {
  const t = useTheme();
  if (!overs.length) return null;
  const max = Math.max(1, ...overs.map((o) => o.runs));
  const w = Math.max(overs.length * COL + 24, 240);
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={w} height={H}>
        <Line x1={0} y1={H - PAD_BOTTOM} x2={w} y2={H - PAD_BOTTOM} stroke={t.border} strokeWidth={1} />
        {overs.map((o, i) => {
          const bh = Math.max(3, (o.runs / max) * plotH);
          const x = i * COL + 18;
          const y = H - PAD_BOTTOM - bh;
          return (
            <G key={o.over}>
              <Rect x={x} y={y} width={20} height={bh} rx={4} fill={o.wickets ? palette.red : palette.pitch} />
              <SvgText x={x + 10} y={y - 5} fontSize={11} fontWeight="bold" fill={t.text} textAnchor="middle">{o.runs}</SvgText>
              <SvgText x={x + 10} y={H - 6} fontSize={10} fill={t.muted} textAnchor="middle">{o.over}</SvgText>
            </G>
          );
        })}
      </Svg>
    </ScrollView>
  );
}

function Dot({ color }: { color: string }) {
  return <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />;
}

/** Both teams' cumulative runs as two lines on one graph (innings comparison). */
export function WormCompare({ series }: { series: { name: string; color: string; overs: OverPoint[] }[] }) {
  const t = useTheme();
  const filled = series.filter((s) => s.overs.length);
  if (!filled.length) return null;
  const maxOvers = Math.max(...filled.map((s) => s.overs.length));
  const maxCum = Math.max(1, ...filled.map((s) => s.overs[s.overs.length - 1]?.cumulative ?? 0));
  const w = Math.max(maxOvers * COL + 24, 240);
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const xOf = (i: number) => i * COL + 28;
  const yOf = (cum: number) => H - PAD_BOTTOM - (cum / maxCum) * plotH;

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 16, marginBottom: 4, flexWrap: "wrap" }}>
        {filled.map((s) => (
          <View key={s.name} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Dot color={s.color} /><Text style={{ color: t.muted, fontSize: 11 }} numberOfLines={1}>{s.name}</Text>
          </View>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={w} height={H}>
          <Line x1={0} y1={H - PAD_BOTTOM} x2={w} y2={H - PAD_BOTTOM} stroke={t.border} strokeWidth={1} />
          {filled.map((s) => (
            <G key={s.name}>
              <Polyline points={s.overs.map((o, i) => `${xOf(i)},${yOf(o.cumulative)}`).join(" ")} fill="none" stroke={s.color} strokeWidth={2.5} />
              {s.overs.map((o, i) => <Circle key={i} cx={xOf(i)} cy={yOf(o.cumulative)} r={2.5} fill={s.color} />)}
            </G>
          ))}
          {Array.from({ length: maxOvers }, (_, i) => (
            <SvgText key={i} x={xOf(i)} y={H - 6} fontSize={10} fill={t.muted} textAnchor="middle">{i + 1}</SvgText>
          ))}
        </Svg>
      </ScrollView>
    </View>
  );
}

/**
 * Worm — cumulative runs (green line + area) AND cumulative wickets (red line)
 * on one graph, with a red marker + "W" where each wicket fell. Two scales so
 * both fit: runs by max score, wickets by max wickets.
 */
export function Worm({ overs }: { overs: OverPoint[] }) {
  const t = useTheme();
  if (!overs.length) return null;
  const maxCum = Math.max(1, overs[overs.length - 1]?.cumulative ?? 1);
  // Running cumulative wickets per over.
  let cw = 0;
  const rows = overs.map((o) => ({ over: o.over, cum: o.cumulative, wkts: o.wickets, cwk: (cw += o.wickets) }));
  const maxWkts = Math.max(1, cw);
  const w = Math.max(overs.length * COL + 24, 240);
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const xOf = (i: number) => i * COL + 28;
  const yRun = (cum: number) => H - PAD_BOTTOM - (cum / maxCum) * plotH;
  const yWk = (cwk: number) => H - PAD_BOTTOM - (cwk / maxWkts) * plotH;
  const runLine = rows.map((p, i) => `${xOf(i)},${yRun(p.cum)}`).join(" ");
  const wkLine = rows.map((p, i) => `${xOf(i)},${yWk(p.cwk)}`).join(" ");
  const area = `${xOf(0)},${H - PAD_BOTTOM} ${runLine} ${xOf(rows.length - 1)},${H - PAD_BOTTOM}`;

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 16, marginBottom: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Dot color={palette.pitchDark} /><Text style={{ color: t.muted, fontSize: 11 }}>Runs</Text></View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Dot color={palette.red} /><Text style={{ color: t.muted, fontSize: 11 }}>Wickets (where out)</Text></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={w} height={H}>
          <Line x1={0} y1={H - PAD_BOTTOM} x2={w} y2={H - PAD_BOTTOM} stroke={t.border} strokeWidth={1} />
          <Polygon points={area} fill={palette.pitch + "22"} />
          {/* Cumulative wickets line (red) */}
          <Polyline points={wkLine} fill="none" stroke={palette.red} strokeWidth={2} strokeDasharray="4 3" />
          {/* Cumulative runs line (green) */}
          <Polyline points={runLine} fill="none" stroke={palette.pitchDark} strokeWidth={2.5} />
          {rows.map((p, i) => (
            <G key={p.over}>
              <Circle cx={xOf(i)} cy={yRun(p.cum)} r={3.5} fill={palette.pitchDark} />
              <SvgText x={xOf(i)} y={yRun(p.cum) - 8} fontSize={9} fill={t.muted} textAnchor="middle">{p.cum}</SvgText>
              {p.wkts > 0 && <Circle cx={xOf(i)} cy={yWk(p.cwk)} r={4.5} fill={palette.red} />}
              {p.wkts > 0 && <SvgText x={xOf(i)} y={yWk(p.cwk) - 8} fontSize={9} fontWeight="bold" fill={palette.red} textAnchor="middle">{p.wkts > 1 ? `${p.wkts}W` : "W"}</SvgText>}
              <SvgText x={xOf(i)} y={H - 6} fontSize={10} fill={t.muted} textAnchor="middle">{p.over}</SvgText>
            </G>
          ))}
        </Svg>
      </ScrollView>
    </View>
  );
}
