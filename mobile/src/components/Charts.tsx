import { ScrollView } from "react-native";
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

/** Worm — cumulative runs as a filled area + line with a dot per over. */
export function Worm({ overs }: { overs: OverPoint[] }) {
  const t = useTheme();
  if (!overs.length) return null;
  const maxCum = Math.max(1, overs[overs.length - 1]?.cumulative ?? 1);
  const w = Math.max(overs.length * COL + 24, 240);
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const pt = (o: OverPoint, i: number) => ({
    x: i * COL + 28,
    y: H - PAD_BOTTOM - (o.cumulative / maxCum) * plotH,
  });
  const pts = overs.map(pt);
  const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const first = pts[0];
  const last = pts[pts.length - 1];
  const area = `${first.x},${H - PAD_BOTTOM} ${line} ${last.x},${H - PAD_BOTTOM}`;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={w} height={H}>
        <Line x1={0} y1={H - PAD_BOTTOM} x2={w} y2={H - PAD_BOTTOM} stroke={t.border} strokeWidth={1} />
        <Polygon points={area} fill={palette.pitch + "26"} />
        <Polyline points={line} fill="none" stroke={palette.pitchDark} strokeWidth={2.5} />
        {overs.map((o, i) => {
          const p = pt(o, i);
          return (
            <G key={o.over}>
              <Circle cx={p.x} cy={p.y} r={3.5} fill={palette.pitchDark} />
              <SvgText x={p.x} y={p.y - 8} fontSize={10} fill={t.muted} textAnchor="middle">{o.cumulative}</SvgText>
              <SvgText x={p.x} y={H - 6} fontSize={10} fill={t.muted} textAnchor="middle">{o.over}</SvgText>
            </G>
          );
        })}
      </Svg>
    </ScrollView>
  );
}
