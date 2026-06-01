"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ScrollText,
  Users,
  Settings,
  FileEdit,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "仪表盘", href: "/admin" },
  { icon: ScrollText, label: "生成记录", href: "/admin/logs" },
  { icon: Users, label: "用户管理", href: "/admin/users" },
  { icon: FileEdit, label: "内容管理", href: "/admin/content" },
  { icon: Settings, label: "API 设置", href: "/admin/settings" },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="h-screen flex bg-stone-50 text-stone-800 antialiased overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-64 shrink-0 bg-white border-r border-stone-200 flex flex-col">
        <div className="px-6 py-5 border-b border-stone-100">
          <h1 className="text-[15px] font-serif font-semibold tracking-tight text-stone-800">
            MPFlow
          </h1>
          <p className="text-[11px] text-stone-400 mt-0.5">Admin Console</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ icon: Icon, label, href }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={label}
                href={href}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-stone-100 text-stone-800"
                    : "text-stone-500 hover:text-stone-700 hover:bg-stone-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-4 border-t border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-[11px] font-medium text-stone-500">
              A
            </div>
            <div>
              <p className="text-[13px] font-medium text-stone-700">Admin</p>
              <p className="text-[11px] text-stone-400">admin@mpflow.dev</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* top bar */}
        <header className="px-8 py-4 border-b border-stone-200/60 bg-white flex items-center justify-between shrink-0">
          <span className="text-[14px] font-medium text-stone-700">
            MPFlow Admin
          </span>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-stone-800 flex items-center justify-center text-[11px] font-medium text-white">
              A
            </div>
          </div>
        </header>

        {/* page content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
