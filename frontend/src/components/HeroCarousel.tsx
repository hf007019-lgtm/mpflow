"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export function HeroCarousel({ images }: { images: string[] }) {
  const N = images.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    if (N <= 1 || paused) return;
    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % N);
    }, 5000);
  }, [N, paused, clearTimer]);

  const goTo = useCallback(
    (i: number) => {
      setIndex(i);
      // reset timer — pause briefly then resume
      clearTimer();
      if (N > 1 && !paused) {
        timerRef.current = setInterval(() => {
          setIndex((prev) => (prev + 1) % N);
        }, 5000);
      }
    },
    [N, paused, clearTimer],
  );

  useEffect(() => {
    startTimer();
    return clearTimer;
  }, [startTimer, clearTimer]);

  // ── 0 images ──
  if (N === 0) {
    return (
      <div className="mt-16 max-w-4xl mx-auto">
        <div className="rounded-2xl bg-white shadow-lg shadow-stone-200/50 ring-1 ring-stone-200/60 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-stone-100/80 border-b border-stone-200/40">
            <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
          </div>
          <div className="aspect-video bg-stone-50 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-stone-100 flex items-center justify-center">
                <div className="w-6 h-6 rounded bg-stone-200" />
              </div>
              <p className="text-[13px] text-stone-400">暂无主视觉图</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-16 max-w-4xl mx-auto">
      <div className="rounded-2xl bg-white shadow-lg shadow-stone-200/50 ring-1 ring-stone-200/60 overflow-hidden">
        {/* browser chrome */}
        <div className="relative z-20 flex items-center gap-2 px-4 py-3 bg-stone-100/80 border-b border-stone-200/40">
          <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
          <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
          <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
        </div>

        {/* viewport */}
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: "16/9", maxHeight: 480 }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* slides */}
          {images.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
                i === index ? "opacity-100 z-10" : "opacity-0 z-0"
              }`}
            />
          ))}

          {/* subtle overlay for text contrast */}
          <div className="absolute inset-0 bg-black/20 z-[11] pointer-events-none" />

          {/* dot indicators */}
          {N > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === index
                      ? "w-5 h-1.5 bg-white shadow-sm"
                      : "w-1.5 h-1.5 bg-white/50 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
