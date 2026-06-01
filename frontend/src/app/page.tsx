import Link from "next/link";
import { Gauge, ImageIcon, MessageSquare, FileText, Zap, Users, ArrowRight } from "lucide-react";
import { getLandingContent, type FeatureItem } from "@/lib/db";
import { HeroCarousel } from "@/components/HeroCarousel";
/* cookies, jwtVerify, UserMenu no longer needed — Navbar handles auth */

/* ───── icon map ───── */
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Gauge, ImageIcon, MessageSquare, FileText, Zap, Users,
};

/* ───── highlight engine ───── */
const HIGHLIGHT_KEYWORDS = ["灵感", "表达", "优雅", "写作", "创作", "智能", "纯粹"];

function TitleWithHighlight({ text }: { text: string }) {
  const flat = text.replace(/\n/g, " ");
  let keyword = "";
  for (const w of HIGHLIGHT_KEYWORDS) {
    if (flat.includes(w)) { keyword = w; break; }
  }
  if (!keyword) return <span className="whitespace-pre-line">{text}</span>;

  const lines = text.split("\n");
  let found = false;
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) nodes.push(<br key={`br-${i}`} />);
    const line = lines[i];
    if (found) { nodes.push(<span key={`ln-${i}`}>{line}</span>); continue; }

    const idx = line.indexOf(keyword);
    if (idx === -1) { nodes.push(<span key={`ln-${i}`}>{line}</span>); continue; }

    found = true;
    if (idx > 0) nodes.push(<span key={`pre-${i}`}>{line.slice(0, idx)}</span>);
    nodes.push(
      <span key={`hl-${i}`} className="text-green-600 relative inline-block">
        {keyword}
        <svg className="absolute -bottom-2 left-0 w-full h-[10px] pointer-events-none" viewBox="0 0 100 10" preserveAspectRatio="none" fill="none">
          <path d="M0 8 Q 12 0, 25 6 T 50 5 T 75 7 T 100 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </span>,
    );
    if (idx + keyword.length < line.length) nodes.push(<span key={`post-${i}`}>{line.slice(idx + keyword.length)}</span>);
  }
  return <>{nodes}</>;
}

export default async function LandingPage() {
  const content = await getLandingContent();

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 antialiased overflow-x-hidden">
      {/* HERO */}
      <section className="pt-16 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex mb-6 px-3 py-1 rounded-full bg-green-100 border border-green-200 text-green-700 text-sm font-medium">
            产品 / 演示
          </div>
          <h1 className="font-sans font-extrabold text-5xl md:text-6xl text-gray-900 tracking-tight leading-tight">
            <TitleWithHighlight text={content.heroTitle} />
          </h1>
          <p className="mt-6 text-lg text-gray-500 leading-relaxed max-w-xl mx-auto">
            {content.heroSubtitle}
          </p>
          <div className="mt-8">
            <Link
              href="/editor"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-[15px] font-medium bg-[#D97757] text-white hover:bg-[#C5694A] hover:-translate-y-1 hover:shadow-lg hover:shadow-[#D97757]/20 transition-all duration-300 shadow-sm"
            >
              开始创作
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
        <HeroCarousel images={content.heroImageUrls} />
      </section>

      {/* FEATURES */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {content.features.map((f: FeatureItem, i: number) => {
              const Icon = iconMap[f.icon] || Gauge;
              const span = i === 0 ? "md:col-span-2" : "md:col-span-1";
              return (
                <div key={i} className={`${span} bg-white rounded-2xl p-6 border border-stone-200/60 shadow-sm`}>
                  <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center mb-4">
                    <Icon className="w-4 h-4 text-stone-500" />
                  </div>
                  <h3 className="text-[16px] font-semibold text-stone-800 mb-2">{f.title}</h3>
                  <p className="text-[14px] text-stone-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 px-6 border-t border-stone-200/40">
        <div className="max-w-6xl mx-auto text-center text-[13px] text-stone-400">
          MPFlow · 公众号文章创作助手
        </div>
      </footer>
    </div>
  );
}
