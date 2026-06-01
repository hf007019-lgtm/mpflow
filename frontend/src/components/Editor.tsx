"use client";

import { useState } from "react";

interface Props {
  onSubmit: (data: {
    topic: string;
    word_count: number;
    with_images: boolean;
    additional_instructions: string;
  }) => void;
  loading: boolean;
}

export default function Editor({ onSubmit, loading }: Props) {
  const [topic, setTopic] = useState("");
  const [wordCount, setWordCount] = useState(1500);
  const [withImages, setWithImages] = useState(true);
  const [extra, setExtra] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed || trimmed.length < 2) return;
    onSubmit({
      topic: trimmed.slice(0, 500),
      word_count: Math.min(Math.max(wordCount, 500), 5000),
      with_images: withImages,
      additional_instructions: extra.trim().slice(0, 500),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full gap-4">
      <div>
        <label className="text-sm font-medium text-gray-400 mb-1.5 block">
          文章主题
        </label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="输入你想写的主题..."
          maxLength={500}
          className="w-full h-28 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
        />
        <div className="text-xs text-gray-600 mt-0.5 text-right">
          {topic.length}/500
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-400 mb-1.5 block">
          目标字数：<span className="text-emerald-400">{wordCount}</span>
        </label>
        <input
          type="range"
          min={500}
          max={5000}
          step={100}
          value={wordCount}
          onChange={(e) => setWordCount(Number(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
        <div className="flex justify-between text-xs text-gray-600">
          <span>500</span>
          <span>5000</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={withImages}
            onChange={(e) => setWithImages(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
        </label>
        <span className="text-sm text-gray-400">自动配图</span>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-400 mb-1.5 block">
          额外指令 <span className="text-gray-600">(可选)</span>
        </label>
        <input
          type="text"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="如：重点对比中国和美国..."
          maxLength={500}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      <button
        type="submit"
        disabled={loading || topic.trim().length < 2}
        className="mt-auto w-full py-3 rounded-lg font-semibold text-sm transition-all bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            生成中...
          </span>
        ) : (
          "开始生成"
        )}
      </button>
    </form>
  );
}
