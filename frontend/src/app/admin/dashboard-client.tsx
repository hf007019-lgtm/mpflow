"use client";

import {
  Users,
  FileText,
  Zap,
  CreditCard,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { DashboardStats } from "@/lib/db";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

export function DashboardClient({ stats }: { stats: DashboardStats }) {
  const metrics = [
    {
      icon: Users,
      label: "总用户数",
      value: stats.totalUsers.toLocaleString(),
    },
    {
      icon: FileText,
      label: "今日生成",
      value: stats.todayGenerations.toLocaleString(),
    },
    {
      icon: Zap,
      label: "积分消耗",
      value: formatNumber(stats.totalPointsConsumed),
    },
    {
      icon: CreditCard,
      label: "当月预估",
      value: formatNumber(stats.monthlyPointsConsumed) + " 积分",
    },
  ];

  return (
    <div className="p-8 space-y-8">
      {/* metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="bg-white rounded-xl border border-stone-200/60 p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] text-stone-500 font-medium">
                {m.label}
              </span>
              <m.icon className="w-4 h-4 text-stone-400" />
            </div>
            <p className="text-2xl font-semibold text-stone-800 tracking-tight tabular-nums">
              {m.value}
            </p>
            <div className="flex items-center gap-1 mt-2">
              <ArrowUpRight className="w-3 h-3 text-stone-300" />
              <span className="text-[12px] text-stone-400">实时数据</span>
            </div>
          </div>
        ))}
      </div>

      {/* chart */}
      <div className="bg-white rounded-xl border border-stone-200/60 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-semibold text-stone-800">
            API 调用趋势
          </h3>
          <span className="text-[12px] text-stone-400">过去 30 天</span>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stats.chartData}
              margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#a8a29e", fontSize: 10 }}
                interval={4}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid #e7e5e4",
                  borderRadius: 10,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  fontSize: 13,
                  color: "#44403c",
                }}
                cursor={{ fill: "transparent" }}
                formatter={(value: unknown) => [`${value} 次`, "调用量"]}
              />
              <Bar
                dataKey="calls"
                fill="#e7e5e4"
                radius={4}
                maxBarSize={28}
                activeBar={{ fill: "#a8a29e", radius: 4 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
