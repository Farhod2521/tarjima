"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/api";
import { setAuth, formatPhone, type AuthUser } from "@/lib/auth";

const API_URL = getApiUrl();

/* ── Lottie player (web-component via innerHTML to avoid TS errors) ── */
function LottiePlayer() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!document.querySelector("script[data-lottie]")) {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/@lottiefiles/dotlottie-wc@0.9.10/dist/dotlottie-wc.js";
      s.type = "module";
      s.dataset.lottie = "1";
      document.head.appendChild(s);
    }
    if (ref.current) {
      ref.current.innerHTML = `<dotlottie-wc
        src="https://lottie.host/4b72a64c-5eba-4ab7-af98-9e7dd650d222/ZfGV03Cbm0.lottie"
        autoplay loop
        style="width:320px;height:320px">
      </dotlottie-wc>`;
    }
  }, []);

  return <div ref={ref} />;
}

/* ── Left panel ─────────────────────────────────────────────────────────── */
function LeftPanel() {
  return (
    <div className="hidden lg:flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 relative overflow-hidden px-12">
      <div className="absolute top-[-80px] left-[-80px] w-72 h-72 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute bottom-[-60px] right-[-60px] w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />

      {/* Logo */}
      <div className="absolute top-8 left-8 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">Standart Tahlil</p>
          <p className="text-slate-400 text-xs">AI Tizim</p>
        </div>
      </div>

      {/* Animation */}
      <div className="relative z-10 flex flex-col items-center">
        <LottiePlayer />
        <h2 className="text-white text-2xl font-bold mt-4 text-center leading-snug">
          Hujjatlarni AI orqali<br />tahlil qiling
        </h2>
        <p className="text-slate-400 text-sm mt-3 text-center max-w-xs leading-relaxed">
          Grammatik xatolar, tarjima va hujjat formatlash — barchasi bitta tizimda
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {["Grammatik tahlil", "Tarjima", "Hujjat tartiblash"].map((f) => (
            <span key={f} className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs text-slate-300 font-medium backdrop-blur-sm">
              ✦ {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Login form ─────────────────────────────────────────────────────────── */
function LoginForm() {
  const router = useRouter();
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePhone(e: React.ChangeEvent<HTMLInputElement>) {
    const d = e.target.value.replace(/\D/g, "").slice(0, 9);
    setPhoneDisplay(formatPhone(d));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = phoneDisplay.replace(/\D/g, "");
    if (digits.length !== 9) return setError("Telefon raqamni to'liq kiriting");
    if (!password.trim()) return setError("Parolni kiriting");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits, password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Xatolik");
      setAuth(data.token, data.user as AuthUser);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Phone */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Telefon raqam</label>
        <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
          <div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border-r border-slate-300 flex-shrink-0">
            <span className="text-xl leading-none">🇺🇿</span>
            <span className="text-sm font-bold text-slate-700">+998</span>
          </div>
          <input
            type="text" inputMode="numeric"
            value={phoneDisplay} onChange={handlePhone}
            placeholder="99 425-25-21" autoFocus
            className="flex-1 px-3 py-3 text-sm focus:outline-none bg-white"
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Parol</label>
        <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
          <input
            type={showPwd ? "text" : "password"}
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="flex-1 px-4 py-3 text-sm focus:outline-none font-mono"
          />
          <button type="button" onClick={() => setShowPwd(v => !v)}
            className="px-3 text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {showPwd
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                     d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
              }
            </svg>
          </button>
        </div>
      </div>

      {error && <ErrorBox text={error} />}

      <button type="submit" disabled={loading}
        className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-sm shadow-blue-200">
        {loading
          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Tekshirilmoqda...</>
          : "Kirish"}
      </button>
    </form>
  );
}

/* ── Register form ──────────────────────────────────────────────────────── */
function RegisterForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);

  function handlePhone(e: React.ChangeEvent<HTMLInputElement>) {
    const d = e.target.value.replace(/\D/g, "").slice(0, 9);
    setPhoneDisplay(formatPhone(d));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = phoneDisplay.replace(/\D/g, "");
    if (!firstName.trim()) return setError("Ism kiritilmadi");
    if (!lastName.trim())  return setError("Familiya kiritilmadi");
    if (!email.includes("@")) return setError("Elektron pochta noto'g'ri");
    if (digits.length !== 9) return setError("Telefon raqam 9 ta raqamdan iborat bo'lishi kerak");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim(), email: email.trim(), phone: digits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Xatolik");
      setSuccess(data.user.password);
      setAuth(data.token, data.user as AuthUser);
      setTimeout(() => router.push("/dashboard"), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setLoading(false);
    }
  }

  if (success) return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <p className="font-bold text-slate-800 text-lg">Muvaffaqiyatli ro'yxatdan o'tdingiz!</p>
        <p className="text-sm text-slate-500 mt-1">Dashboardga o'tmoqda...</p>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Ism</label>
          <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
            placeholder="Farhod"
            className="w-full px-3 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Familiya</label>
          <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
            placeholder="Abdullayev"
            className="w-full px-3 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Elektron pochta</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="farhod@example.com"
          className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Telefon raqam</label>
        <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
          <div className="flex items-center gap-2 px-3 py-3 bg-slate-50 border-r border-slate-300 flex-shrink-0">
            <span className="text-xl leading-none">🇺🇿</span>
            <span className="text-sm font-bold text-slate-700">+998</span>
          </div>
          <input type="text" inputMode="numeric"
            value={phoneDisplay} onChange={handlePhone}
            placeholder="99 425-25-21"
            className="flex-1 px-3 py-3 text-sm focus:outline-none bg-white" />
        </div>
      </div>

      {error && <ErrorBox text={error} />}

      <button type="submit" disabled={loading}
        className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-sm shadow-blue-200">
        {loading
          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Ro'yxatdan o'tilmoqda...</>
          : "Ro'yxatdan o'tish"}
      </button>
    </form>
  );
}

/* ── Error box ──────────────────────────────────────────────────────────── */
function ErrorBox({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {text}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const [tab, setTab] = useState<"login" | "register">("login");

  return (
    <div className="min-h-screen flex">
      {/* Left — animation */}
      <div className="lg:w-1/2">
        <LeftPanel />
      </div>

      {/* Right — forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-md">
          {/* Logo (mobile only) */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="font-bold text-slate-800">Standart Tahlil AI</p>
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h1 className="text-2xl font-extrabold text-slate-900">
              {tab === "login" ? "Tizimga kirish" : "Hisob yaratish"}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {tab === "login"
                ? "Telefon raqam va parolingizni kiriting"
                : "Ma'lumotlaringizni to'ldiring"}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
            {([
              { key: "login",    label: "Kirish" },
              { key: "register", label: "Ro'yxatdan o'tish" },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  tab === key
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Form area */}
          <div>
            {tab === "login"
              ? <LoginForm />
              : <RegisterForm />}
          </div>

          {/* Bottom hint */}
          <p className="text-center text-xs text-slate-400 mt-6">
            {tab === "login" ? (
              <>Hisob yo'qmi?{" "}
                <button onClick={() => setTab("register")} className="text-blue-600 font-semibold hover:underline">
                  Ro'yxatdan o'tish
                </button></>
            ) : (
              <>Hisobingiz bormi?{" "}
                <button onClick={() => setTab("login")} className="text-blue-600 font-semibold hover:underline">
                  Kirish
                </button></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
