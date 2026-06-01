"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "@/components/UserMenu";
import { PointsBalance } from "@/components/PointsBalance";

const navLinks = [
  { label: "首页", href: "/" },
  { label: "创作", href: "/editor", dot: true },
  { label: "生图", href: "#" },
];

export function Navbar() {
  const pathname = usePathname();
  const [session, setSession] = useState<{ name?: string; email?: string; picture?: string } | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setSession(d.user))
      .catch(() => setSession(null));
  }, []);

  return (
    <nav className="fixed top-0 inset-x-0 z-50">
      <div className="flex items-center justify-between max-w-7xl mx-auto px-6 h-16">
        {/* left: logo + name */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <img src="/logo.png" alt="Logo" className="h-[30px] w-auto rounded-lg" />
          <span className="font-extrabold text-xl tracking-tight text-gray-900">MPFlow</span>
        </Link>

        {/* center: pill nav */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-1 bg-white rounded-full border border-gray-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] px-1.5 py-1.5">
            {navLinks.map(({ label, href, dot }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={label}
                  href={href}
                  className={`relative flex items-center gap-1.5 text-sm transition-colors duration-200 ${
                    isActive
                      ? "bg-gray-100 text-gray-900 font-medium rounded-full px-5 py-2"
                      : "text-gray-500 hover:text-gray-900 px-4 py-2"
                  }`}
                >
                  {dot && (
                    <span className={`w-1.5 h-1.5 rounded-full transition-colors ${isActive ? "bg-red-500" : "bg-red-400"}`} />
                  )}
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* right: auth */}
        <div className="flex items-center gap-3 shrink-0">
          {session === undefined ? (
            <>
              <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse" />
              <div className="w-20 h-8 rounded-full bg-gray-100 animate-pulse" />
            </>
          ) : session ? (
            <>
              <UserMenu name={session.name} email={session.email} image={session.picture} />
              <PointsBalance />
            </>
          ) : (
            <div className="flex items-center gap-2">
              <a href="/api/auth/login/logto" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">登录</a>
              <a href="/api/auth/login/logto?mode=register" className="text-sm bg-gray-900 text-white hover:bg-gray-800 px-4 py-2 rounded-full transition-colors">注册</a>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
