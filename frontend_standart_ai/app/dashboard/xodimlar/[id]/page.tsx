"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/api";
import { authHeaders } from "@/lib/auth";

const API_URL = getApiUrl();
const PAGE_SIZE = 10;

// ── Types ─────────────────────────────────────────────────────────────────────

type GrammarHistory = {
  id: number; filename: string; standard_name: string | null;
  issues_count: number; file_id: string | null; created_at: string;
};
type TranslationHistory = {
  id: number; filename: string; from_lang: string;
  to_lang: string; file_id: string | null; created_at: string;
};
type FormattingHistory = {
  id: number; filename: string; font: string | null;
  font_size: number | null; file_id: string | null; created_at: string;
};
type UserDetail = {
  id: number; first_name: string; last_name: string; email: string;
  phone: string; role: string; password: string;
  can_grammar: boolean; can_tarjima: boolean; can_hujjat: boolean;
  created_at: string;
  grammar_history: GrammarHistory[];
  translation_history: TranslationHistory[];
  formatting_history: FormattingHistory[];
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", director: "Direktor", employee: "Xodim",
};
const LANG_LABELS: Record<string, string> = {
  uzbek: "O'zbek", russian: "Rus", english: "Ingliz",
  uz: "O'zbek", ru: "Rus", en: "Ingliz",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("uz-UZ", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({
  total, page, onPage,
}: { total: number; page: number; onPage: (p: number) => void }) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
      <span className="text-xs text-slate-500">
        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total} ta
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
              p === page
                ? "bg-blue-600 text-white"
                : "text-slate-500 hover:bg-white hover:text-slate-800"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          disabled={page === pages}
          onClick={() => onPage(page + 1)}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── File download icon ─────────────────────────────────────────────────────────

function FileIcon({ href, title }: { href: string; title?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title ?? "Yuklab olish"}
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex-shrink-0"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
    </a>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <svg className="w-10 h-10 mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-sm">{text}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"grammar" | "translation" | "formatting">("grammar");
  const [showPassword, setShowPassword] = useState(false);

  // Pagination per tab
  const [grammarPage, setGrammarPage] = useState(1);
  const [translationPage, setTranslationPage] = useState(1);
  const [formattingPage, setFormattingPage] = useState(1);

  useEffect(() => {
    async function fetchUser() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/users/${userId}`, {
          headers: authHeaders(), cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setUser(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Xatolik");
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [userId]);

  if (loading) return (
    <div className="flex items-center justify-center h-full gap-3 text-slate-400">
      <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
      <span className="text-sm">Yuklanmoqda...</span>
    </div>
  );

  if (error || !user) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
      <p>{error ?? "Foydalanuvchi topilmadi"}</p>
      <button onClick={() => router.back()}
        className="px-4 py-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200 transition-colors">
        Orqaga
      </button>
    </div>
  );

  const tabs = [
    { key: "grammar" as const,     label: "Grammatik Tahlil", count: user.grammar_history.length,     icon: "📝" },
    { key: "translation" as const, label: "Tarjima",          count: user.translation_history.length, icon: "🌐" },
    { key: "formatting" as const,  label: "Hujjat Tartiblash",count: user.formatting_history.length,  icon: "📄" },
  ];

  // Paged slices
  const grammarRows    = user.grammar_history.slice((grammarPage - 1) * PAGE_SIZE, grammarPage * PAGE_SIZE);
  const translationRows= user.translation_history.slice((translationPage - 1) * PAGE_SIZE, translationPage * PAGE_SIZE);
  const formattingRows = user.formatting_history.slice((formattingPage - 1) * PAGE_SIZE, formattingPage * PAGE_SIZE);

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="px-8 py-5 bg-white border-b border-slate-200 flex items-center gap-4">
        <button onClick={() => router.back()}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{user.first_name} {user.last_name}</h1>
          <p className="text-slate-500 text-sm mt-0.5">Xodim tarixi va ma'lumotlari</p>
        </div>
      </div>

      <div className="flex-1 p-8 space-y-6">
        {/* User info card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-blue-500 flex items-center justify-center flex-shrink-0 shadow">
              <span className="text-white font-bold text-2xl">{user.first_name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 font-medium mb-0.5">Ism</p>
                <p className="text-slate-800 font-semibold">{user.first_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium mb-0.5">Familiya</p>
                <p className="text-slate-800 font-semibold">{user.last_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium mb-0.5">Telefon</p>
                <p className="text-slate-800 font-mono">{user.phone}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium mb-0.5">Elektron pochta</p>
                <p className="text-slate-800">{user.email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium mb-0.5">Parol</p>
                <div className="flex items-center gap-2">
                  <p className="text-slate-800 font-mono">
                    {showPassword ? user.password : "•".repeat(user.password.length)}
                  </p>
                  <button onClick={() => setShowPassword(v => !v)}
                    className="text-slate-400 hover:text-slate-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showPassword
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
              <div>
                <p className="text-xs text-slate-400 font-medium mb-0.5">Role</p>
                <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  user.role === "admin"     ? "bg-red-100 text-red-700"    :
                  user.role === "director"  ? "bg-purple-100 text-purple-700" :
                                              "bg-slate-100 text-slate-600"
                }`}>
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="mt-5 pt-5 border-t border-slate-100 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-400 font-medium mr-1">Ruxsatlar:</span>
            {[
              { label: "Grammatik Tahlil", active: user.can_grammar },
              { label: "Tarjima",          active: user.can_tarjima },
              { label: "Hujjat Tartiblash",active: user.can_hujjat  },
            ].map(p => (
              <span key={p.label} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                p.active
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-slate-50 border-slate-200 text-slate-400"
              }`}>
                {p.active ? "✓" : "✗"} {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* History tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Tab nav */}
          <div className="flex border-b border-slate-200 px-4 pt-2">
            {tabs.map(tab => (
              <button key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors mr-1 ${
                  activeTab === tab.key
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}>
                <span>{tab.icon}</span>
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === tab.key ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* ── Grammar tab ── */}
          {activeTab === "grammar" && (
            user.grammar_history.length === 0 ? <EmptyState text="Grammatik tahlil tarixi yo'q" /> : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase w-10">№</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Fayl nomi</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Standart</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Xatolar</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Sana</th>
                      <th className="px-5 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {grammarRows.map((h, i) => (
                      <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5 text-slate-400 font-mono text-xs">
                          {(grammarPage - 1) * PAGE_SIZE + i + 1}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="font-medium text-slate-700 truncate max-w-xs">{h.filename}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 text-xs">{h.standard_name ?? "—"}</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            h.issues_count > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                          }`}>
                            {h.issues_count} ta xato
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 text-xs">{formatDate(h.created_at)}</td>
                        <td className="px-5 py-3.5">
                          {h.file_id
                            ? <FileIcon href={`${API_URL}/download/${h.file_id}?format=docx`} title="To'g'irlangan faylni yuklab olish" />
                            : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination total={user.grammar_history.length} page={grammarPage} onPage={setGrammarPage} />
              </>
            )
          )}

          {/* ── Translation tab ── */}
          {activeTab === "translation" && (
            user.translation_history.length === 0 ? <EmptyState text="Tarjima tarixi yo'q" /> : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase w-10">№</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Fayl nomi</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Tarjima yo'nalishi</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Sana</th>
                      <th className="px-5 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {translationRows.map((h, i) => (
                      <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5 text-slate-400 font-mono text-xs">
                          {(translationPage - 1) * PAGE_SIZE + i + 1}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="font-medium text-slate-700 truncate max-w-xs">{h.filename}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                            {LANG_LABELS[h.from_lang] ?? h.from_lang}
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            {LANG_LABELS[h.to_lang] ?? h.to_lang}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 text-xs">{formatDate(h.created_at)}</td>
                        <td className="px-5 py-3.5">
                          {h.file_id
                            ? <FileIcon href={`${API_URL}/translate/${h.file_id}/download`} title="Tarjima faylini yuklab olish" />
                            : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination total={user.translation_history.length} page={translationPage} onPage={setTranslationPage} />
              </>
            )
          )}

          {/* ── Formatting tab ── */}
          {activeTab === "formatting" && (
            user.formatting_history.length === 0 ? <EmptyState text="Hujjat tartiblash tarixi yo'q" /> : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase w-10">№</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Fayl nomi</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Shrift</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">O'lcham</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Sana</th>
                      <th className="px-5 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {formattingRows.map((h, i) => (
                      <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5 text-slate-400 font-mono text-xs">
                          {(formattingPage - 1) * PAGE_SIZE + i + 1}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="font-medium text-slate-700 truncate max-w-xs">{h.filename}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 text-xs">{h.font ?? "—"}</td>
                        <td className="px-5 py-3.5 text-slate-500 text-xs">{h.font_size ? `${h.font_size}pt` : "—"}</td>
                        <td className="px-5 py-3.5 text-slate-400 text-xs">{formatDate(h.created_at)}</td>
                        <td className="px-5 py-3.5">
                          {h.file_id
                            ? <FileIcon href={`${API_URL}/document-format/${h.file_id}/download`} title="Formatlangan faylni yuklab olish" />
                            : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination total={user.formatting_history.length} page={formattingPage} onPage={setFormattingPage} />
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
