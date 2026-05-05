"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "@/lib/api";

const API_URL = getApiUrl();

type Report = {
  id: number;
  employee_name: string;
  standard_name: string;
  docx_filename: string;
  created_at: string;
  standards_count: number;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("uz-UZ", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function HisobatPage() {
  const [reports, setReports]   = useState<Report[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  async function fetchReports() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/reports/`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReports(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchReports(); }, []);

  async function handleDelete(id: number) {
    setDeleteId(id);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/reports/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? `HTTP ${res.status}`);
      }
      await fetchReports();
    } catch (e) {
      setError(e instanceof Error ? e.message : "O'chirishda xatolik");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-5 bg-white border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-800">Xodimlar hisobati</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Har bir xodim uchun birlashtirilgan grammatik tahlil hisoboti
        </p>
      </div>

      <div className="flex-1 p-8 overflow-auto">
        {/* Stats */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-semibold text-indigo-700">
              {reports.length} ta xodim
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
            <button onClick={fetchReports} className="ml-auto underline font-medium">Qayta</button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
              <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
              <span className="text-sm">Yuklanmoqda...</span>
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-slate-500 font-medium">Hisobotlar yo'q</p>
              <p className="text-slate-400 text-sm mt-1">
                Grammatik Tahlil sahifasida xodim tanlang va tahlil bajaring
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">№</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Xodim</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tahlil qilingan standartlar</th>
                  <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">So'nggi tahlil</th>
                  <th className="text-center px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Hisobot</th>
                  <th className="px-4 py-3.5 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 text-slate-400 font-mono text-xs">{idx + 1}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-indigo-700 font-bold text-sm">
                            {r.employee_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-slate-800">{r.employee_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-teal-100 text-teal-700 text-xs font-bold">
                          {r.standards_count}
                        </span>
                        <span className="text-slate-500 text-xs">
                          {r.standards_count === 1 ? "ta standart" : "ta standart"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">{formatDate(r.created_at)}</td>
                    <td className="px-6 py-4 text-center">
                      <a
                        href={`${API_URL}/reports/${r.id}/download?v=${encodeURIComponent(r.created_at)}`}
                        download={`${r.employee_name}_hisobot.docx`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Yuklab olish
                      </a>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={deleteId === r.id}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        {deleteId === r.id ? (
                          <div className="w-4 h-4 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
