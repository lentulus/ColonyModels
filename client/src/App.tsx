import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ParamsC, StateC } from "@colonymodels/shared";
import { advanceTick } from "./sim/integrator";

// Phase1Design §17 blank-run defaults.
const BLANK_PARAMS: ParamsC = { r: 0.02, beta: 0.25, c: 3, s0: 1 };
const BLANK_INITIAL: StateC = { N: 0.2, S: 0 };
const HORIZON_YEARS = 1000; // notional placeholder — F-1.3.3-1
const DT_INTEG_YEARS = 1 / 365.25;
const TICK_YEARS = 1; // integration resolution unchanged; time-scale is display-only
const PEOPLE_PER_UNIT = 1000; // §17 default; §8.3 display semantics.

const N_COLOR = "#5aa0ff";
const S_COLOR = "#e07c2c";

type SamplePoint = {
  t: number;
  N_people: number;
  N_scaled: number;
  S_people: number;
  S_scaled: number;
};

function integrateHardcodedRun(): SamplePoint[] {
  const out: SamplePoint[] = [
    {
      t: 0,
      N_people: BLANK_INITIAL.N * PEOPLE_PER_UNIT,
      N_scaled: BLANK_INITIAL.N,
      S_people: BLANK_INITIAL.S * PEOPLE_PER_UNIT,
      S_scaled: BLANK_INITIAL.S,
    },
  ];
  let cur: StateC = BLANK_INITIAL;
  for (let year = 1; year <= HORIZON_YEARS; year++) {
    cur = advanceTick(cur, BLANK_PARAMS, TICK_YEARS, DT_INTEG_YEARS);
    out.push({
      t: year,
      N_people: cur.N * PEOPLE_PER_UNIT,
      N_scaled: cur.N,
      S_people: cur.S * PEOPLE_PER_UNIT,
      S_scaled: cur.S,
    });
  }
  return out;
}

function compactNumber(v: number): string {
  if (!isFinite(v)) return String(v);
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1_000) return (v / 1_000).toFixed(0) + "k";
  return v.toFixed(0);
}

function indexedTick(v: number): string {
  if (!isFinite(v)) return String(v);
  const abs = Math.abs(v);
  const digits = abs < 10 ? 1 : 0;
  return v.toFixed(digits).replace(/\.0$/, "") + "×";
}

type DisplayPoint = SamplePoint & {
  t_display: number;
  N_y: number | null;
  S_y: number | null;
};

type TooltipEntry = { payload: DisplayPoint };
type TimeScale = "years" | "decades";

// Display-unit conversion: years → years; decades → years/10.
// `t_display` in the data array is *already* in the displayed unit, so
// formatters here just stringify with the right suffix — no division.
function toDisplayUnit(t: number, scale: TimeScale): number {
  return scale === "decades" ? t / 10 : t;
}

function formatTimeLabel(tDisplay: number, scale: TimeScale): string {
  const digits = Number.isInteger(tDisplay) ? 0 : 1;
  return `${tDisplay.toFixed(digits)} ${scale === "decades" ? "dec" : "yr"}`;
}

type CustomTooltipProps = {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: number | string;
  indexed: boolean;
  showN: boolean;
  showS: boolean;
  timeScale: TimeScale;
};

function CustomTooltip({
  active,
  payload,
  label,
  indexed,
  showN,
  showS,
  timeScale,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  const labelNum = typeof label === "number" ? label : Number(label);
  const timeText = isFinite(labelNum)
    ? formatTimeLabel(labelNum, timeScale)
    : String(label);

  // In indexed mode, suppress a series' row at t < t*_X (where X_y is null
  // because we've not yet reached the first indexable sample).
  const showNRow = showN && (!indexed || p.N_y !== null);
  const showSRow = showS && (!indexed || p.S_y !== null);

  const nLine =
    indexed && p.N_y !== null
      ? `${p.N_y.toFixed(3)}× (${p.N_people.toLocaleString()} settlers; scaled ${p.N_scaled.toFixed(4)})`
      : `${p.N_people.toLocaleString()} settlers (scaled ${p.N_scaled.toFixed(4)})`;

  const sLine =
    indexed && p.S_y !== null
      ? `${p.S_y.toFixed(3)}× (${p.S_people.toLocaleString()} person-yr; scaled ${p.S_scaled.toFixed(4)})`
      : `${p.S_people.toLocaleString()} person-yr (scaled ${p.S_scaled.toFixed(4)})`;

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #ccc",
        borderRadius: 4,
        padding: "8px 12px",
        fontSize: "0.85rem",
        fontFamily: "system-ui, sans-serif",
        boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ marginBottom: 4 }}>
        <strong>t = {timeText}</strong>
      </div>
      {showNRow && <div style={{ color: N_COLOR }}>N: {nLine}</div>}
      {showSRow && <div style={{ color: S_COLOR }}>S: {sLine}</div>}
    </div>
  );
}

function toggleButtonStyle(active: boolean, color: string): CSSProperties {
  return {
    background: active ? color : "white",
    color: active ? "white" : color,
    border: `1.5px solid ${color}`,
    borderRadius: 4,
    padding: "4px 12px",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontFamily: "system-ui, sans-serif",
    fontWeight: 500,
  };
}

export function App() {
  const [showN, setShowN] = useState(true);
  const [showS, setShowS] = useState(true);
  const [indexed, setIndexed] = useState(false);
  const [timeScale, setTimeScale] = useState<TimeScale>("years");

  const baseData = useMemo(() => integrateHardcodedRun(), []);

  // Per-series first-nonzero index (D-1.3.3-8). When a series is zero at t=0,
  // the indexed line starts at its first positive sample instead of being
  // hidden. Returns -1 if the series never goes positive (in practice this
  // shouldn't happen for §17 defaults; the line just stays gapped if so).
  const indices = useMemo(() => {
    let iN = -1;
    let iS = -1;
    for (let i = 0; i < baseData.length; i++) {
      if (iN < 0 && baseData[i].N_scaled > 0) iN = i;
      if (iS < 0 && baseData[i].S_scaled > 0) iS = i;
      if (iN >= 0 && iS >= 0) break;
    }
    return { iN, iS };
  }, [baseData]);

  const data = useMemo<DisplayPoint[]>(() => {
    const addDisplay = (p: SamplePoint, y: { N_y: number | null; S_y: number | null }) => ({
      ...p,
      t_display: toDisplayUnit(p.t, timeScale),
      ...y,
    });
    if (!indexed) {
      return baseData.map((p) => addDisplay(p, { N_y: p.N_people, S_y: p.S_people }));
    }
    const nRef = indices.iN >= 0 ? baseData[indices.iN].N_scaled : null;
    const sRef = indices.iS >= 0 ? baseData[indices.iS].S_scaled : null;
    return baseData.map((p, i) =>
      addDisplay(p, {
        N_y: nRef !== null && i >= indices.iN ? p.N_scaled / nRef : null,
        S_y: sRef !== null && i >= indices.iS ? p.S_scaled / sRef : null,
      }),
    );
  }, [baseData, indexed, indices, timeScale]);

  const yTickFormatter = indexed ? indexedTick : compactNumber;
  const xAxisLabel =
    timeScale === "decades"
      ? "t (decades since founding)"
      : "t (years since founding)";

  // Explicit integer-valued X ticks (D-1.3.3-9, D-1.3.3-11, D-1.3.3-13).
  // Years mode: every 5 years (201 ticks). Decades mode: every 1 decade
  // (101 ticks). Recharts thins via interval="preserveStartEnd" when
  // labels would overlap at wide zooms; at narrow brush zooms more ticks
  // are visible (giving the user "multiples of 5" readability).
  const xTicks = useMemo(() => {
    const out: number[] = [];
    const stepYears = timeScale === "decades" ? 10 : 5;
    for (let y = 0; y <= HORIZON_YEARS; y += stepYears) {
      out.push(toDisplayUnit(y, timeScale));
    }
    return out;
  }, [timeScale]);

  // Y domain pinned to the max across currently-visible series over the
  // full data extent (D-1.3.3-10) — Y stays still as the brush moves,
  // only rescales when toggling N/S. 5% headroom above the max.
  const yDomain = useMemo<[number, number]>(() => {
    let max = 0;
    for (const p of data) {
      if (showN && p.N_y !== null && p.N_y > max) max = p.N_y;
      if (showS && p.S_y !== null && p.S_y > max) max = p.S_y;
    }
    if (max === 0) return [0, 1];
    return [0, max * 1.05];
  }, [data, showN, showS]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        padding: "16px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h2 style={{ margin: "0 0 12px 0" }}>
        ColonyModels — {HORIZON_YEARS}-year hardcoded run (§17 defaults)
      </h2>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setShowN((v) => !v)}
          aria-pressed={showN}
          style={toggleButtonStyle(showN, N_COLOR)}
        >
          N (settlers) {showN ? "on" : "off"}
        </button>
        <button
          onClick={() => setShowS((v) => !v)}
          aria-pressed={showS}
          style={toggleButtonStyle(showS, S_COLOR)}
        >
          S (person-yr) {showS ? "on" : "off"}
        </button>
        <div style={{ width: 24 }} />
        <button
          onClick={() => setIndexed((v) => !v)}
          aria-pressed={indexed}
          style={toggleButtonStyle(indexed, "#444")}
        >
          Indexed {indexed ? "on" : "off"}
        </button>
        <button
          onClick={() =>
            setTimeScale((v) => (v === "years" ? "decades" : "years"))
          }
          aria-pressed={timeScale === "decades"}
          style={toggleButtonStyle(timeScale === "decades", "#444")}
        >
          Decades {timeScale === "decades" ? "on" : "off"}
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="t_display"
              type="number"
              ticks={xTicks}
              interval="preserveStartEnd"
              label={{
                value: xAxisLabel,
                position: "bottom",
                offset: 18,
              }}
            />
            <YAxis tickFormatter={yTickFormatter} domain={yDomain} allowDataOverflow />
            <Tooltip
              content={
                <CustomTooltip
                  indexed={indexed}
                  showN={showN}
                  showS={showS}
                  timeScale={timeScale}
                />
              }
            />
            <Legend
              verticalAlign="top"
              height={28}
              onClick={(payload) => {
                const dk = (payload as { dataKey?: unknown }).dataKey;
                if (dk === "N_y") setShowN((v) => !v);
                if (dk === "S_y") setShowS((v) => !v);
              }}
              wrapperStyle={{ cursor: "pointer" }}
            />
            <Line
              type="monotone"
              dataKey="N_y"
              stroke={N_COLOR}
              dot={false}
              name="N (settlers)"
              isAnimationActive={false}
              hide={!showN}
            />
            <Line
              type="monotone"
              dataKey="S_y"
              stroke={S_COLOR}
              dot={false}
              name="S (person-years of production)"
              isAnimationActive={false}
              hide={!showS}
            />
            <Brush
              dataKey="t_display"
              height={28}
              stroke="#888"
              travellerWidth={8}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
