"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/api";
import { setAuth, formatPhone, type AuthUser } from "@/lib/auth";

const API_URL = getApiUrl();

export default function RegisterPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handlePhoneInput(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
    setPhoneDisplay(formatPhone(digits));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const phoneDigits = phoneDisplay.replace(/\D/g, "");
    if (!firstName.trim()) return setError("Ism kiritilmadi");
    if (!lastName.trim()) return setError("Familiya kiritilmadi");
    if (!email.trim() || !email.includes("@")) return setError("Elektron pochta noto'g'ri");
    if (phoneDigits.length !== 9) return setError("Telefon raqam 9 ta raqamdan iborat bo'lishi kerak");

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phoneDigits,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Xatolik yuz berdi");

      const user: AuthUser = data.user;
      const generatedPassword = user.password;

      setSuccess(`Ro'yxatdan o'tish muvaffaqiyatli! Parolingiz: ${generatedPassword}`);
      setAuth(data.token, user);

      setTimeout(() => router.push("/dashboard"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-tight">Standart Tahlil</p>
            <p className="text-slate-400 text-xs">AI Tizim</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100">
            <h1 className="text-xl font-bold text-slate-800">Ro'yxatdan o'tish</h1>
            <p className="text-slate-500 text-sm mt-1">Yangi hisob yaratish</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
            {/* First & Last name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Ism</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Farhod"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Familiya</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Abdullayev"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Elektron pochta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="farhod@example.com"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Telefon raqam</label>
              <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border-r border-slate-300 flex-shrink-0">
                  <span className="text-xl leading-none">🇺🇿</span>
                  <span className="text-sm font-semibold text-slate-700">+998</span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={phoneDisplay}
                  onChange={handlePhoneInput}
                  placeholder="99 425-25-21"
                  className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-white"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold">{success.split("!")[0]}!</p>
                  <p className="mt-0.5 font-mono text-green-700">{success.split("Parolingiz: ")[1]}</p>
                  <p className="mt-1 text-xs text-green-600">Dashboardga o'tmoqda...</p>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !!success}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Ro'yxatdan o'tilmoqda...
                </>
              ) : (
                "Ro'yxatdan o'tish"
              )}
            </button>
          </form>

          <div className="px-8 pb-6 text-center">
            <p className="text-sm text-slate-500">
              Hisobingiz bormi?{" "}
              <Link href="/login" className="text-blue-600 font-semibold hover:underline">
                Kirish
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
