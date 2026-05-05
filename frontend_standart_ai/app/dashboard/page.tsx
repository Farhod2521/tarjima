"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUser, type AuthUser } from "@/lib/auth";

/* ── Stat card ───────────────────────────────────────────────────────────── */
function StatCard({
  label, value, sub, color, icon,
}: {
  label: string; value: string | number; sub?: string;
  color: "blue" | "violet" | "emerald" | "amber";
  icon: React.ReactNode;
}) {
  const colors = {
    blue:    { bg: "bg-blue-50",    text: "text-blue-600",    ring: "ring-blue-100",   val: "text-blue-700"   },
    violet:  { bg: "bg-violet-50",  text: "text-violet-600",  ring: "ring-violet-100", val: "text-violet-700" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-100",val: "text-emerald-700"},
    amber:   { bg: "bg-amber-50",   text: "text-amber-600",   ring: "ring-amber-100",  val: "text-amber-700"  },
  };
  const c = colors[color];
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-xl ${c.bg} ring-1 ${c.ring} flex items-center justify-center flex-shrink-0 ${c.text}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={`text-2xl font-extrabold ${c.val} leading-none`}>{value}</p>
        <p className="text-sm font-medium text-slate-600 mt-0.5 truncate">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Quick action card ───────────────────────────────────────────────────── */
function ActionCard({
  href, title, desc, badge, gradient, icon,
}: {
  href: string; title: string; desc: string;
  badge?: string; gradient: string; icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="group block bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5 overflow-hidden">
      {/* Top gradient strip */}
      <div className={`h-1.5 w-full ${gradient}`} />
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-bold text-slate-800 text-sm">{title}</p>
              {badge && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-md">{badge}</span>
              )}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
          </div>
          <div className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Step card ───────────────────────────────────────────────────────────── */
function StepCard({ step, title, desc, icon }: { step: string; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-extrabold shadow-sm">
          {step}
        </div>
        <div className="text-slate-400">{icon}</div>
      </div>
      <h3 className="font-bold text-slate-800 text-sm mb-1">{title}</h3>
      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Xayrli tong";
    if (h < 17) return "Xayrli kun";
    return "Xayrli kech";
  };

  const actions = [
    {
      href: "/dashboard/grammar",
      title: "Grammatik Tahlil",
      desc: "PDF yoki Word hujjatingizdagi imlo, grammatika va tinish xatolarini AI orqali aniqlang",
      badge: "AI",
      gradient: "bg-gradient-to-r from-blue-500 to-indigo-500",
      show: !user || user.role === "admin" || user.role === "director" || user.can_grammar,
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      href: "/dashboard/tarjima",
      title: "Tarjima",
      desc: "Word hujjatini o'zbek, rus yoki ingliz tilidan boshqa tilga avtomatik tarjima qiling",
      badge: "AI",
      gradient: "bg-gradient-to-r from-violet-500 to-purple-500",
      show: !user || user.role === "admin" || user.role === "director" || user.can_tarjima,
      icon: (
        <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
      ),
    },
    {
      href: "/dashboard/hujjat-tartiblash",
      title: "Hujjat Tartiblash",
      desc: "Hujjatdagi tinish belgilari, bo'shliqlar va shrift formatini avtomatik to'g'irlang",
      gradient: "bg-gradient-to-r from-emerald-500 to-teal-500",
      show: !user || user.role === "admin" || user.role === "director" || user.can_hujjat,
      icon: (
        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m-7 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2h-1M9 7h1m4 10l2 2 4-4" />
        </svg>
      ),
    },
  ].filter(a => a.show);

  return (
    <div className="flex-1 overflow-auto">
      {/* ── Hero header ── */}
      <div className="px-8 py-7 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400 font-medium mb-0.5">
              {greeting()}{user ? `, ${user.first_name}` : ""}! 👋
            </p>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Standart Tahlil AI — hujjatlar tahlili va boshqaruv tizimi
            </p>
          </div>
          {user && (
            <div className="hidden md:flex items-center gap-3 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-sm">{user.first_name.charAt(0)}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 leading-tight">{user.first_name} {user.last_name}</p>
                <p className="text-xs text-slate-400">{
                  user.role === "admin" ? "Administrator" :
                  user.role === "director" ? "Direktor" : "Xodim"
                }</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-8 py-7 space-y-8">
        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Grammatik tahlil" value="—" sub="Tahlil qilingan" color="blue"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
          />
          <StatCard label="Tarjimalar" value="—" sub="Tarjima qilingan" color="violet"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>}
          />
          <StatCard label="Tartiblangan" value="—" sub="Hujjat formatlangan" color="emerald"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m-7 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2h-1M9 7h1m4 10l2 2 4-4" /></svg>}
          />
          <StatCard label="Xodimlar" value="—" sub="Tizimda ro'yxatda" color="amber"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          />
        </div>

        {/* ── Quick actions ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Tezkor harakatlar</h2>
              <p className="text-xs text-slate-400 mt-0.5">Kerakli bo'limni tanlang</p>
            </div>
            <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full font-medium">
              {actions.length} ta bo'lim
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {actions.map((a) => (
              <ActionCard key={a.href} href={a.href} title={a.title} desc={a.desc}
                badge={a.badge} gradient={a.gradient} icon={a.icon} />
            ))}
          </div>
        </div>

        {/* ── How it works ── */}
        <div>
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-800">Qanday ishlaydi?</h2>
            <p className="text-xs text-slate-400 mt-0.5">3 ta oddiy qadam</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StepCard step="1" title="Fayl yuklang"
              desc="PDF yoki Word (.docx) hujjatingizni sudrab tashlang yoki tanlang"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>}
            />
            <StepCard step="2" title="AI tahlil qiladi"
              desc="GPT modeli matnni chunklarga bo'lib, parallel tarzda xatolarni aniqlaydi"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
            />
            <StepCard step="3" title="Yuklab oling"
              desc="To'g'irlangan hujjatni PDF yoki Word formatda yuklab oling"
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
            />
          </div>
        </div>

        {/* ── Info banner ── */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 flex items-center gap-5 shadow-lg shadow-blue-100">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-white font-bold">Standart Tahlil AI</p>
            <p className="text-blue-100 text-sm mt-0.5">
              O'zbekiston milliy standartlariga mos grammatik tahlil, tarjima va hujjat formatlash tizimi
            </p>
          </div>
          <Link href="/dashboard/grammar"
            className="flex-shrink-0 px-4 py-2 bg-white text-blue-700 text-sm font-bold rounded-xl hover:bg-blue-50 transition-colors shadow-sm">
            Boshlash →
          </Link>
        </div>
      </div>
    </div>
  );
}
