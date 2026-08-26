"use client";

import React, { useState } from "react";
import { TrendingUp, ShoppingBag, ArrowUpRight, DollarSign, Calendar } from "lucide-react";
import { formatINR } from "@/lib/utils";

export interface DayData {
  date: string;
  label: string;
  revenue: number;
  orders: number;
}

export interface CategoryShare {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export default function AnalyticsCharts({
  data7d,
  data30d,
  categoryShare,
}: {
  data7d: DayData[];
  data30d: DayData[];
  categoryShare: CategoryShare[];
}) {
  const [range, setRange] = useState<"7d" | "30d">("7d");
  const [activePoint, setActivePoint] = useState<DayData | null>(null);

  const activeData = range === "7d" ? data7d : data30d;
  const maxRevenue = Math.max(...activeData.map((d) => d.revenue), 1000);
  const maxOrders = Math.max(...activeData.map((d) => d.orders), 5);
  const totalRevenue = activeData.reduce((sum, d) => sum + d.revenue, 0);
  const totalOrders = activeData.reduce((sum, d) => sum + d.orders, 0);

  // SVG Chart coordinate calculations
  const svgWidth = 700;
  const svgHeight = 220;
  const paddingX = 40;
  const paddingY = 30;
  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingY * 2;

  const points = activeData.map((item, index) => {
    const x = paddingX + (index / Math.max(activeData.length - 1, 1)) * chartWidth;
    const y = svgHeight - paddingY - (item.revenue / maxRevenue) * chartHeight;
    return { x, y, item };
  });

  // Generate SVG cubic bezier path
  const linePath = points.reduce((acc, point, i, arr) => {
    if (i === 0) return `M ${point.x},${point.y}`;
    const prev = arr[i - 1];
    const cp1x = prev.x + (point.x - prev.x) / 2;
    const cp2x = prev.x + (point.x - prev.x) / 2;
    return `${acc} C ${cp1x},${prev.y} ${cp2x},${point.y} ${point.x},${point.y}`;
  }, "");

  // Area path for gradient fill
  const areaPath = `${linePath} L ${points[points.length - 1]?.x || 0},${
    svgHeight - paddingY
  } L ${points[0]?.x || 0},${svgHeight - paddingY} Z`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Revenue & Sales Chart Card */}
      <div className="lg:col-span-8 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-xs)] font-bold uppercase tracking-wider text-[var(--color-fg-muted)]">
                Sales & Revenue Analytics
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <TrendingUp size={12} /> +18.4% vs last period
              </span>
            </div>
            <p className="text-2xl font-black text-[var(--color-fg)] font-mono mt-1">
              {formatINR(totalRevenue)}
            </p>
            <p className="text-[var(--text-xs)] text-[var(--color-fg-subtle)]">
              {totalOrders} completed orders across {range === "7d" ? "last 7 days" : "last 30 days"}
            </p>
          </div>

          {/* Time range selector */}
          <div className="flex items-center bg-[var(--color-surface-sunken)] p-1 rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--text-xs)] font-semibold">
            <button
              type="button"
              onClick={() => setRange("7d")}
              className={`px-3 py-1 rounded-[var(--radius-sm)] transition-all ${
                range === "7d"
                  ? "bg-[var(--color-surface)] text-[var(--color-fg)] shadow-xs font-bold"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setRange("30d")}
              className={`px-3 py-1 rounded-[var(--radius-sm)] transition-all ${
                range === "30d"
                  ? "bg-[var(--color-surface)] text-[var(--color-fg)] shadow-xs font-bold"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              }`}
            >
              30 Days
            </button>
          </div>
        </div>

        {/* Interactive Native SVG Chart */}
        <div className="relative w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto overflow-visible select-none"
          >
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = paddingY + ratio * chartHeight;
              return (
                <g key={ratio}>
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={svgWidth - paddingX}
                    y2={y}
                    stroke="var(--color-border-subtle)"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={paddingX - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="text-[9px] fill-[var(--color-fg-subtle)] font-mono"
                  >
                    {Math.round((1 - ratio) * maxRevenue) >= 1000
                      ? `₹${Math.round(((1 - ratio) * maxRevenue) / 1000)}k`
                      : `₹${Math.round((1 - ratio) * maxRevenue)}`}
                  </text>
                </g>
              );
            })}

            {/* Area Fill */}
            <path d={areaPath} fill="url(#revenueGrad)" />

            {/* Main Trend Line */}
            <path
              d={linePath}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Interactive Points */}
            {points.map((p, i) => (
              <g key={i} className="cursor-pointer">
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={activePoint?.date === p.item.date ? "6" : "4"}
                  fill={activePoint?.date === p.item.date ? "var(--color-primary)" : "#ffffff"}
                  stroke="var(--color-primary)"
                  strokeWidth="2"
                  className="transition-all"
                  onMouseEnter={() => setActivePoint(p.item)}
                />
                {/* X-axis labels */}
                <text
                  x={p.x}
                  y={svgHeight - 10}
                  textAnchor="middle"
                  className="text-[10px] fill-[var(--color-fg-muted)] font-mono"
                >
                  {p.item.label}
                </text>
              </g>
            ))}
          </svg>

          {/* Active Data Tooltip */}
          {activePoint && (
            <div className="absolute top-2 right-4 bg-slate-900 text-white p-2.5 rounded-md shadow-lg text-xs font-mono animate-in fade-in">
              <p className="text-slate-400 text-[10px]">{activePoint.date}</p>
              <p className="font-bold text-emerald-400">{formatINR(activePoint.revenue)}</p>
              <p className="text-[11px] text-slate-300">{activePoint.orders} orders</p>
            </div>
          )}
        </div>
      </div>

      {/* Category Share & Quick Breakdown */}
      <div className="lg:col-span-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-5 sm:p-6 shadow-sm flex flex-col justify-between">
        <div>
          <span className="text-[var(--text-xs)] font-bold uppercase tracking-wider text-[var(--color-fg-muted)]">
            Category Breakdown
          </span>
          <h3 className="text-base font-bold text-[var(--color-fg)] mt-1 mb-4">
            Catalog & Demand Share
          </h3>

          <div className="space-y-4">
            {categoryShare.map((cat) => (
              <div key={cat.name} className="space-y-1 text-[var(--text-xs)]">
                <div className="flex justify-between font-medium">
                  <span className="text-[var(--color-fg)]">{cat.name}</span>
                  <span className="font-mono font-bold text-[var(--color-fg)]">
                    {cat.percentage}%
                  </span>
                </div>
                <div className="h-2 bg-[var(--color-surface-sunken)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-3.5 rounded-[var(--radius-md)] text-[var(--text-xs)] text-[var(--color-fg-muted)] space-y-1">
          <p className="font-bold text-[var(--color-fg)]">💡 Operational Highlight:</p>
          <p className="text-[11px] leading-relaxed">
            BLDC Fans and Solar Lighting lead regional volume in Suriyawan market with highest repeat
            reorders.
          </p>
        </div>
      </div>
    </div>
  );
}
