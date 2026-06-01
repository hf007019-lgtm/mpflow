"use client";

import { useState, useRef, useEffect } from "react";
import { LogOut, User } from "lucide-react";

export function UserMenu({ name, email, image }: { name?: string; email?: string; image?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const logout = () => {
    window.location.href = "/api/auth/logout";
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 hover:border-gray-300 transition-colors"
      >
        {image ? (
          <img src={image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <User className="w-4 h-4 text-gray-400" />
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border border-gray-100 shadow-lg py-1 z-50">
          <div className="px-4 py-2 border-b border-gray-50">
            <p className="text-[13px] font-medium text-gray-700 truncate">{name || email || "用户"}</p>
            {email && <p className="text-[11px] text-gray-400 truncate">{email}</p>}
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
