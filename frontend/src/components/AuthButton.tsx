"use client";

import { useState, useEffect } from "react";
import { LogOut } from "lucide-react";

interface SessionUser {
  name?: string;
  email?: string;
  image?: string;
  id?: string;
}

export function AuthButton() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  if (user === undefined) {
    return <div className="w-20 h-9 rounded-full bg-gray-100 animate-pulse" />;
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        {user.image ? (
          <img src={user.image} alt="" className="w-8 h-8 rounded-full border border-gray-200" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-xs font-medium text-white">
            {(user.name || "U").charAt(0).toUpperCase()}
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">退出</span>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => (window.location.href = "/api/auth/login/logto")}
      className="shrink-0 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm"
    >
      登录
    </button>
  );
}
