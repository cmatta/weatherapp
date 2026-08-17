"use client";

import type { TideExtreme, TidePrediction } from "../models/tidePrediction";

interface TideChartProps {
  chartData: TidePrediction[];
  extremes?: TideExtreme[];
  now: number;
  timeZone?: string;
  width?: number;
  height?: number;
}

// Only use e-ink colors: black, white, red, yellow, blue, green, orange
const EINK_COLORS = {
  black: "var(--inky-black)",
  blue: "var(--inky-blue)",
  red: "var(--inky-red)",
};

const THREE_HOURS = 3 * 60 * 60 * 1000;
// Nothing below 14px: smaller glyphs lose their stems to the dither.
const LABEL_SIZE = 14;
const STROKE_WIDTH = 3;
// A white halo keeps a label readable where it crosses the tide line or the
// 'now' marker; on e-ink a clean white gap beats overlapping ink.
const HALO = {
  stroke: "var(--inky-white)",
  strokeWidth: 4,
  paintOrder: "stroke" as const,
};

/** Milliseconds to add to a UTC instant to get wall-clock time in `timeZone`. */
function zoneOffset(timeZone: string, at: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(at));
  const part = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  return Date.UTC(part("year"), part("month") - 1, part("day"), part("hour") % 24, part("minute")) - at;
}

export default function TideChart({
  chartData,
  extremes = [],
  now,
  timeZone = "America/New_York",
  width = 772,
  height = 172,
}: TideChartProps) {
  if (!chartData || chartData.length === 0) {
    return (
      <div style={{ color: EINK_COLORS.red, fontSize: LABEL_SIZE, fontWeight: 700 }}>
        No valid chart data to display.
      </div>
    );
  }

  const margin = { top: 22, right: 10, bottom: 38, left: 36 };
  const plotHeight = height - margin.top - margin.bottom;
  const maxDrawableX = width - margin.right - STROKE_WIDTH / 2;

  // X and Y data extents
  const times = chartData.map(d => d.time);
  const heights = chartData.map(d => d.height);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const minHeight = Math.floor(Math.min(...heights));
  const maxHeight = Math.ceil(Math.max(...heights));
  // Pad the domain so crests and troughs stay off the frame. The bottom gets
  // the wider gap: low-water labels hang below their dot and must clear the
  // x-axis labels.
  const domainMin = minHeight - 2.2;
  const domainMax = maxHeight + 0.6;

  const xScale = (t: number) => {
    const x = margin.left + ((t - minTime) / (maxTime - minTime || 1)) * (maxDrawableX - margin.left);
    return Math.min(Math.max(x, margin.left), maxDrawableX);
  };
  const yScale = (h: number) =>
    margin.top + plotHeight - ((h - domainMin) / (domainMax - domainMin || 1)) * plotHeight;

  // Generate SVG polyline points
  const points = chartData.map(d => `${xScale(d.time)},${yScale(d.height)}`).join(" ");

  // X-axis ticks snapped to 3-hour wall-clock boundaries (12 AM, 3 AM, ...).
  const offset = zoneOffset(timeZone, minTime);
  const xTicks: number[] = [];
  for (
    let t = Math.ceil((minTime + offset) / THREE_HOURS) * THREE_HOURS - offset;
    t <= maxTime;
    t += THREE_HOURS
  ) {
    xTicks.push(t);
  }

  // Y-axis ticks: whole feet, thinned to at most five labels.
  const step = Math.max(1, Math.ceil((maxHeight - minHeight) / 4));
  const yTicks: number[] = [];
  for (let h = minHeight; h <= maxHeight; h += step) {
    yTicks.push(h);
  }

  const hourLabel = (t: number) =>
    new Date(t).toLocaleTimeString("en-US", { timeZone, hour: "numeric" });
  const clockLabel = (t: number) =>
    new Date(t).toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  // Keep edge labels inside the frame: the anchor flips near either end.
  const anchorFor = (x: number) =>
    x < margin.left + 38 ? "start" : x > width - 38 ? "end" : "middle";

  const visibleExtremes = extremes.filter(e => e.time >= minTime && e.time <= maxTime);

  return (
    <svg
      data-testid="tide-chart"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Axes */}
      <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} stroke={EINK_COLORS.black} strokeWidth={2} />
      <line x1={margin.left} y1={height - margin.bottom} x2={maxDrawableX} y2={height - margin.bottom} stroke={EINK_COLORS.black} strokeWidth={2} />
      <text
        x={margin.left - 6}
        y={margin.top - 8}
        fontSize={LABEL_SIZE}
        fontWeight={700}
        fill={EINK_COLORS.black}
        textAnchor="end"
      >
        ft
      </text>
      {/* Y ticks and labels */}
      {yTicks.map(y => (
        <g key={y}>
          <line
            x1={margin.left - 5}
            y1={yScale(y)}
            x2={margin.left}
            y2={yScale(y)}
            stroke={EINK_COLORS.black}
            strokeWidth={2}
          />
          <text
            x={margin.left - 8}
            y={yScale(y) + 5}
            fontSize={LABEL_SIZE}
            fontWeight={600}
            fill={EINK_COLORS.black}
            textAnchor="end"
          >
            {y}
          </text>
        </g>
      ))}
      {/* X ticks and labels */}
      {xTicks.map(t => {
        const x = xScale(t);
        return (
          <g key={t}>
            <line
              x1={x}
              y1={height - margin.bottom}
              x2={x}
              y2={height - margin.bottom + 5}
              stroke={EINK_COLORS.black}
              strokeWidth={2}
            />
            <text
              x={x}
              y={height - margin.bottom + 18}
              fontSize={LABEL_SIZE}
              fontWeight={600}
              fill={EINK_COLORS.black}
              textAnchor={anchorFor(x)}
            >
              {hourLabel(t)}
            </text>
          </g>
        );
      })}
      {/* Tide line */}
      <polyline
        fill="none"
        stroke={EINK_COLORS.blue}
        strokeWidth={STROKE_WIDTH}
        points={points}
      />
      {/* High and low water marks. Highs label above the dot, lows below, so
          neither label lands on the tide line. */}
      {visibleExtremes.map(extreme => {
        const x = xScale(extreme.time);
        const y = yScale(extreme.height);
        return (
          <g key={`${extreme.type}-${extreme.time}`}>
            <circle cx={x} cy={y} r={5} fill={EINK_COLORS.blue} />
            <text
              x={x}
              y={extreme.type === 'H' ? y - 10 : y + 17}
              fontSize={LABEL_SIZE}
              fontWeight={700}
              fill={EINK_COLORS.blue}
              textAnchor={anchorFor(x)}
              {...HALO}
            >
              {clockLabel(extreme.time)}
            </text>
          </g>
        );
      })}
      {/* 'Now' marker */}
      {now >= minTime && now <= maxTime && (
        <g>
          <line
            x1={xScale(now)}
            y1={margin.top}
            x2={xScale(now)}
            y2={height - margin.bottom}
            stroke={EINK_COLORS.red}
            strokeWidth={3}
          />
          <text
            x={xScale(now)}
            y={margin.top - 8}
            fontSize={LABEL_SIZE}
            fill={EINK_COLORS.red}
            textAnchor={anchorFor(xScale(now))}
            fontWeight="bold"
            {...HALO}
          >
            now
          </text>
        </g>
      )}
    </svg>
  );
}
