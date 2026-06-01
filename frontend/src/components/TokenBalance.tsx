"use client";

import { useState, useEffect } from "react";
import { Coins } from "lucide-react";

export function TokenBalance() {
  const [tokens, setTokens] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        if (d.user) {
          return fetch("/api/user/tokens").then((r) => (r.ok ? r.json() : { used: 0 }));
        }
        return { used: 0 };
      })
      .then((d) => setTokens(d.used || 0))
      .catch(() => setTokens(0));
  }, []);

  if (tokens === null) {
    return <div className="w-24 h-9 rounded-full bg-gray-100 animate-pulse" />;
  }

  const used = tokens;
  const formatted = used >= 10000
    ? `${(used / 1000).toFixed(1)}K`
    : used.toLocaleString();

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200/50 hover:bg-gray-100 transition-colors cursor-pointer select-none"
      title={used > 0 ? `已消耗 ${used.toLocaleString()} tokens` : "暂无消耗"}
    >
      <Coins className="w-4 h-4 text-amber-500" />
      <span className="text-sm font-semibold text-gray-900 tabular-nums tracking-tight">
        {formatted}
      </span>
    </div>
  );
}
