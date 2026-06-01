"use client";

import { useState, useEffect, useRef } from "react";
import { History, RotateCcw, Eye, Clock, X } from "lucide-react";

interface Snapshot {
  id: string;
  time: string;
  content: string;
  wordCount: number;
}

const SNAPSHOT_KEY = "mpflow_snapshots";
const MAX_SNAPSHOTS = 20;
const AUTO_SAVE_INTERVAL = 60_000; // 1 min

export function VersionHistory({
  currentContent,
  onRestore,
}: {
  currentContent: string;
  onRestore: (content: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const lastContent = useRef(currentContent);

  // Load snapshots from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (raw) setSnapshots(JSON.parse(raw));
    } catch { /* */ }
  }, []);

  // Auto-save every AUTO_SAVE_INTERVAL
  useEffect(() => {
    const timer = setInterval(() => {
      if (currentContent && currentContent.length > 50 && currentContent !== lastContent.current) {
        lastContent.current = currentContent;
        saveSnapshot(currentContent);
      }
    }, AUTO_SAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [currentContent]);

  const saveSnapshot = (content: string) => {
    if (!content || content.length < 50) return;
    const snap: Snapshot = {
      id: Date.now().toString(36),
      time: new Date().toLocaleString("zh-CN"),
      content: content.slice(0, 20000), // cap for localStorage
      wordCount: content.length,
    };
    setSnapshots((prev) => {
      const updated = [snap, ...prev].slice(0, MAX_SNAPSHOTS);
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const manualSave = () => saveSnapshot(currentContent);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg border transition-colors ${
          open ? "border-neutral-400 bg-neutral-100 text-neutral-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"
        }`}
      >
        <History className="w-3 h-3" />
        历史版本
        {snapshots.length > 0 && (
          <span className="text-[10px] text-gray-400">({snapshots.length})</span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-lg z-40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">历史版本</h3>
            <div className="flex items-center gap-2">
              <button
                type="button" onClick={manualSave}
                className="text-[11px] px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                立即保存
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {snapshots.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">
              暂无快照。点击"立即保存"或等待 60 秒自动保存。
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className={`p-2.5 rounded-lg border transition-colors ${
                    previewing === snap.id ? "border-neutral-400 bg-neutral-50" : "border-gray-100 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-600">{snap.time}</span>
                      <span className="text-[10px] text-gray-400">{snap.wordCount.toLocaleString()}字</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewing(previewing === snap.id ? null : snap.id)}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${previewing === snap.id ? "bg-amber-100 text-amber-700" : "text-gray-400 hover:text-gray-600"}`}
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { onRestore(snap.content); setOpen(false); }}
                        className="text-[10px] px-1.5 py-0.5 rounded text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                        title="恢复此版本"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* preview */}
                  {previewing === snap.id && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed border border-gray-100">
                      {snap.content.slice(0, 500)}
                      {snap.content.length > 500 && <span className="text-gray-400">…</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
