"use client";

import { useState } from "react";
import { Search, X, Plus, Minus, Coins } from "lucide-react";
import { type UserRow } from "@/lib/db";
import { toggleUserStatusAction, deleteUserAction, adjustUserPoints } from "@/lib/actions";

export function UserTable({ users }: { users: UserRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = query
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query),
      )
    : users;

  return (
    <div className="bg-white rounded-xl border border-stone-200/60 overflow-hidden">
      <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-stone-800">用户列表</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value.toLowerCase())}
            placeholder="搜索姓名或邮箱…"
            className="w-56 pl-9 pr-3 py-2 rounded-lg border border-stone-200/60 bg-white text-[13px] text-stone-700 placeholder:text-stone-400 outline-none focus:border-stone-300 focus:ring-1 focus:ring-stone-300/50 transition-colors"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-stone-100">
              <th className="text-left px-6 py-3 text-[12px] font-medium text-stone-400 uppercase tracking-wider">用户</th>
              <th className="text-left px-6 py-3 text-[12px] font-medium text-stone-400 uppercase tracking-wider">邮箱</th>
              <th className="text-left px-6 py-3 text-[12px] font-medium text-stone-400 uppercase tracking-wider">已消耗积分</th>
              <th className="text-left px-6 py-3 text-[12px] font-medium text-stone-400 uppercase tracking-wider">剩余积分</th>
              <th className="text-left px-6 py-3 text-[12px] font-medium text-stone-400 uppercase tracking-wider">状态</th>
              <th className="text-left px-6 py-3 text-[12px] font-medium text-stone-400 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u.id}
                className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors"
              >
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-[11px] font-medium text-stone-500">
                      {u.name.charAt(0)}
                    </div>
                    <span className="text-[13px] font-medium text-stone-700">{u.name}</span>
                  </div>
                </td>
                <td className="px-6 py-3 text-[13px] text-stone-500">{u.email}</td>
                <td className="px-6 py-3 text-[13px] text-stone-500 font-mono tabular-nums">
                  {u.pointsUsed.toLocaleString()}
                </td>
                <td className="px-6 py-3">
                  <span className={`text-[13px] font-mono font-semibold tabular-nums ${
                    (u.pointsBalance || 0) < 10 ? "text-red-500" : "text-stone-700"
                  }`}>
                    {(u.pointsBalance || 0).toLocaleString()}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <StatusBadge status={u.status} />
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-1.5">
                    <PointsAdjustButton id={u.id} name={u.name} currentBalance={u.pointsBalance || 0} />
                    <ToggleButton id={u.id} status={u.status} />
                    <DeleteButton id={u.id} name={u.name} />
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-[13px] text-stone-400">
                  无匹配用户
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span className={`inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
      active ? "bg-emerald-50 text-emerald-700 border-emerald-200/60" : "bg-stone-100 text-stone-500 border-stone-200/60"
    }`}>
      {active ? "Active" : "Suspended"}
    </span>
  );
}

/* ───── Points quick-adjust modal ───── */
function PointsAdjustButton({ id, name, currentBalance }: { id: string; name: string; currentBalance: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(100);
  const [pending, setPending] = useState(false);

  const adjust = async (delta: number) => {
    setPending(true);
    await adjustUserPoints(id, delta);
    setPending(false);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-medium px-2 py-1 rounded-lg border border-stone-200/60 text-stone-500 hover:text-stone-700 hover:bg-stone-50 transition-colors"
        title="调整积分"
      >
        <Coins className="w-3 h-3" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl border border-stone-200 shadow-lg p-5 w-72" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-stone-800">调整积分</h4>
              <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[13px] text-stone-500 mb-1">{name}</p>
            <p className="text-2xl font-bold text-stone-800 font-mono mb-4">{currentBalance.toLocaleString()} <span className="text-sm font-normal text-stone-400">剩余</span></p>

            <div className="flex items-center gap-2 mb-4">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
                className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm font-mono outline-none focus:border-stone-300"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button" disabled={pending}
                onClick={() => adjust(amount)}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />充值
              </button>
              <button
                type="button" disabled={pending}
                onClick={() => adjust(-amount)}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />扣除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ToggleButton({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = useState(false);
  const isActive = status === "active";

  return (
    <button
      disabled={pending}
      onClick={async () => { setPending(true); await toggleUserStatusAction(id); setPending(false); }}
      className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
        isActive ? "border-amber-200/60 text-amber-600 hover:bg-amber-50" : "border-emerald-200/60 text-emerald-600 hover:bg-emerald-50"
      }`}
    >
      {pending ? "…" : isActive ? "封禁" : "解封"}
    </button>
  );
}

function DeleteButton({ id, name }: { id: string; name: string }) {
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)} className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-red-200/60 text-red-500 hover:bg-red-50 transition-colors">
        删除
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1 text-[11px]">
      <span className="text-stone-500">确认？</span>
      <button disabled={pending} onClick={async () => { setPending(true); await deleteUserAction(id); setPending(false); }}
        className="font-medium text-red-600 hover:text-red-700">确定</button>
      <button onClick={() => setConfirm(false)} className="text-stone-400 hover:text-stone-600"><X className="w-3 h-3" /></button>
    </span>
  );
}
