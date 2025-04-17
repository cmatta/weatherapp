"use client";


interface TideChartProps {
  chartData: { time: number; height: number }[];
  timeZone?: string;
}

// Only use e-ink colors: black, white, red, yellow, blue, green, orange
const EINK_COLORS = {
  black: "#000000",
  white: "#FFFFFF",
  red: "#E60026",
  yellow: "#FFDD00",
  blue: "#0051BA",
  green: "#009739",
  orange: "#FF6900",
};

export default function TideChart({ chartData, timeZone = "America/New_York" }: TideChartProps) {
  // Deep debug: log chartData
  if (typeof window !== "undefined") {
    console.log("[TideChart] chartData:", chartData);
  }
  if (!chartData || chartData.length === 0) {
    return (
      <div style={{ color: EINK_COLORS.red, fontSize: 12 }}>
        No valid chart data to display.
      </div>
    );
  }

  // SVG chart dimensions
  const width = 800;
  const height = 120;
  const margin = { top: 20, right: 40, bottom: 20, left: 40 };
  const plotWidth = width - margin.left - margin.right - 1; // subtract 1px for safety
  const plotHeight = height - margin.top - margin.bottom;

  // X and Y data extents
  const times = chartData.map(d => d.time);
  const heights = chartData.map(d => d.height);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const minHeight = Math.floor(Math.min(...heights));
  const maxHeight = Math.ceil(Math.max(...heights));

  // Stroke width for main lines
  const STROKE_WIDTH = 3;
  // xScale: minTime -> margin.left, maxTime -> width - margin.right - 1 - STROKE_WIDTH/2
  const maxX = width - margin.right - 1;
  const maxDrawableX = maxX - STROKE_WIDTH / 2;
  const xScale = (t: number) => {
    const x = margin.left + ((t - minTime) / (maxTime - minTime || 1)) * (maxDrawableX - margin.left);
    return Math.min(x, maxDrawableX); // clamp to inside right edge
  };
  const yScale = (h: number) =>
    margin.top + plotHeight - ((h - minHeight) / (maxHeight - minHeight || 1)) * plotHeight;

  // Generate SVG polyline points
  const points = chartData.map(d => `${xScale(d.time)},${yScale(d.height)}`).join(" ");

  // X-axis ticks (every 6 hours if possible)
  const tickCount = 5;
  const xTicks = Array.from({ length: tickCount }, (_, i) =>
    minTime + ((maxTime - minTime) * i) / (tickCount - 1)
  );

  // Y-axis ticks (integer heights)
  const yTicks = Array.from({ length: maxHeight - minHeight + 1 }, (_, i) => minHeight + i);

  return (
    <div style={{ width: '100%', height: 120, overflow: 'hidden' }}>
      <svg width="100%" height="100%" viewBox="0 0 800 120" preserveAspectRatio="none">
        {/* 'Now' marker */}
        {(() => {
          const now = Date.now();
          if (now >= minTime && now <= maxTime) {
            const xNow = xScale(now);
            return (
              <g>
                <line
                  x1={xNow}
                  y1={margin.top}
                  x2={xNow}
                  y2={height - margin.bottom}
                  stroke={EINK_COLORS.red}
                  strokeWidth={2}
                />
                <text
                  x={xNow}
                  y={margin.top - 6}
                  fontSize={14}
                  fill={EINK_COLORS.red}
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  now
                </text>
              </g>
            );
          }
          return null;
        })()}
        {/* Axes */}
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} stroke={EINK_COLORS.black} strokeWidth={2} />
        <line x1={margin.left} y1={height - margin.bottom} x2={maxDrawableX} y2={height - margin.bottom} stroke={EINK_COLORS.black} strokeWidth={2} />
        {/* Y ticks and labels */}
        {yTicks.map(y => (
          <g key={y}>
            <line
              x1={margin.left - 5}
              y1={yScale(y)}
              x2={margin.left}
              y2={yScale(y)}
              stroke={EINK_COLORS.black}
              strokeWidth={1}
            />
            <text
              x={margin.left - 8}
              y={yScale(y) + 4}
              fontSize={12}
              fill={EINK_COLORS.black}
              textAnchor="end"
            >
              {y}
            </text>
          </g>
        ))}
        {/* X ticks and labels */}
        {xTicks.map((t, i) => {
          const x = Math.min(xScale(t), maxDrawableX);
          return (
            <g key={t}>
              <line
                x1={x}
                y1={height - margin.bottom}
                x2={x}
                y2={height - margin.bottom + 5}
                stroke={EINK_COLORS.black}
                strokeWidth={1}
              />
              <text
                x={x}
                y={height - margin.bottom + 18}
                fontSize={12}
                fill={EINK_COLORS.black}
                textAnchor="middle"
              >
                {new Date(t).toLocaleTimeString([], { hour: 'numeric', timeZone })}
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
      </svg>
    </div>
  );
}


