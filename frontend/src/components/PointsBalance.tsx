"use client";

import { useState, useEffect } from "react";
import { Coins } from "lucide-react";

export function PointsBalance() {
  const [data, setData] = useState<{ usedPoints: number; pointsBalance: number } | null>(null);

  useEffect(() => {
    fetchPoints();
    const handler = () => fetchPoints();
    window.addEventListener("points-updated", handler);
    return () => window.removeEventListener("points-updated", handler);
  }, []);

  function fetchPoints() {
    fetch("/api/user/points")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null));
  }

  if (data === null) {
    return <div className="w-20 h-8 rounded-full bg-gray-100 animate-pulse" />;
  }

  const balance = data.pointsBalance;
  const formatted = balance.toLocaleString();

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200/50 hover:bg-gray-100 transition-colors cursor-pointer select-none"
      title={`${balance} 积分可用 | 已消耗 ${data.usedPoints} 积分`}
    >
      <Coins className="w-4 h-4 text-amber-500" />
      <span className="text-sm font-semibold text-gray-900 tabular-nums tracking-tight">
        {formatted}
      </span>
    </div>
  );
}
