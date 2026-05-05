"use client";

import { useState, useRef, useCallback } from "react";
import { getApiUrl } from "@/lib/api";
import { authHeaders } from "@/lib/auth";

const API_URL = getApiUrl();
const MAX_FILE_SIZE_MB = 200;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const LANGS = [
  { value: "uzbek",   label: "O'zbek tili" },
  { value: "russian", label: "Rus tili" },
  { value: "english", label: "Ingliz tili" },
];

type JobState = {
  status:   "pending" | "processing" | "done" | "error";
  progress: number;
  total:    number;
  done:     number;
  error:    string | null;
  filename: string;
};

export default function TarjimaPage() {
  const [file, setFile]           = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fromLang, setFromLang]   = useState("russian");
  const [toLang, setToLang]       = useState("uzbek");
  const [jobId, setJobId]         = useState<string | null>(null);
  const [jobState, setJobState]   = useState<JobState | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const fileInputRef              = useRef<HTMLInputElement>(null);
  const esRef                     = useRef<EventSource | null>(null);

  const handleFileSelect = (f: File) => {
    if (!f.name.toLowerCase().endsWith(".docx")) {
      setErrorMsg("Faqat .docx (Word) fayl qabul qilinadi");
      return;
    }
    if (f.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg(`Fayl hajmi ${MAX_FILE_SIZE_MB}MB dan oshmasligi kerak`);
      return;
    }
    setFile(f);
    setErrorMsg(null);
    setJobId(null);
    setJobState(null);
  };

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, []);

  const swapLangs = () => {
    setFromLang(toLang);
    setToLang(fromLang);
  };

  const handleStart = async () => {
    if (!file || fromLang === toLang) return;
    setIsStarting(true);
    setErrorMsg(null);
    setJobState(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("from_lang", fromLang);
      fd.append("to_lang", toLang);

      const res = await fetch(`${API_URL}/translate/`, { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ?? `HTTP ${res.status}`);
      }
      const { job_id } = await res.json();
      setJobId(job_id);
      startSSE(job_id);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setIsStarting(false);
    }
  };

  const startSSE = (id: string) => {
    if (esRef.current) esRef.current.close();
    const es = new EventSource(`${API_URL}/translate/${id}/progress`);
    esRef.current = es;

    es.onmessage = (e) => {
      const data: JobState = JSON.parse(e.data);
      setJobState(data);
      if (data.status === "done" || data.status === "error") {
        es.close();
      }
      if (data.status === "done") {
        fetch(`${API_URL}/history/translation`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            filename: data.filename || file?.name || "unknown",
            from_lang: fromLang,
            to_lang: toLang,
            file_id: id,
          }),
        }).catch(() => {});
      }
    };
    es.onerror = () => {
      es.close();
      setErrorMsg("Ulanish uzildi");
    };
  };

  const reset = () => {
    esRef.current?.close();
    setFile(null);
    setJobId(null);
    setJobState(null);
    setErrorMsg(null);
  };

  const isDone      = jobState?.status === "done";
  const isProcessing = jobState?.status === "processing" || jobState?.status === "pending" || isStarting;
  const progress    = jobState?.progress ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-5 bg-white border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-800">Tarjima</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Word (.docx) hujjatini bir tildan boshqa tilga tarjima qilish
        </p>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-2xl mx-auto flex flex-col gap-5">

          {/* Til tanlash */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Tarjima yo'nalishi
            </p>
            <div className="flex items-center gap-3">
              {/* From */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Dan</label>
                <select
                  value={fromLang}
                  onChange={(e) => setFromLang(e.target.value)}
                  disabled={isProcessing}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {LANGS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>

              {/* Swap */}
              <button
                onClick={swapLangs}
                disabled={isProcessing}
                className="mt-5 p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors disabled:opacity-40"
                title="Almashtirsih"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </button>

              {/* To */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Ga</label>
                <select
                  value={toLang}
                  onChange={(e) => setToLang(e.target.value)}
                  disabled={isProcessing}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {LANGS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {fromLang === toLang && (
              <p className="mt-2 text-xs text-amber-600">
                ⚠ Manba va maqsad tili bir xil bo'lmasligi kerak
              </p>
            )}
          </div>

          {/* Fayl yuklash */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Fayl (.docx)
            </p>

            {!file ? (
              <div
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 py-12 select-none
                  ${isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50"}`}
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="font-semibold text-slate-700">Faylni yuklash</p>
                <p className="text-sm text-slate-400 mt-1">Suring yoki bosing · .docx · maks. {MAX_FILE_SIZE_MB}MB</p>
                <input
                  ref={fileInputRef} type="file" accept=".docx" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
              </div>
            ) : (
              <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate text-sm">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                {!isProcessing && (
                  <button onClick={reset} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Xato */}
          {errorMsg && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {errorMsg}
            </div>
          )}

          {/* Progress */}
          {(isProcessing || isDone) && jobState && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-slate-800 text-sm">
                  {isDone ? "Tarjima tayyor!" : "Tarjima qilinmoqda..."}
                </p>
                <span className={`text-lg font-bold ${isDone ? "text-green-600" : "text-blue-600"}`}>
                  {progress}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${isDone ? "bg-green-500" : "bg-blue-500"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {!isDone && jobState.total > 0 && (
                <p className="text-xs text-slate-400">
                  {jobState.done} / {jobState.total} paragraf tarjima qilindi
                </p>
              )}

              {isDone && (
                <div className="mt-4 flex items-center gap-3">
                  <a
                    href={`${API_URL}/translate/${jobId}/download`}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    Tarjimani yuklab olish (.docx)
                  </a>
                  <button
                    onClick={reset}
                    className="px-4 py-2.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Yangi tarjima
                  </button>
                </div>
              )}

              {jobState.status === "error" && (
                <p className="mt-2 text-sm text-red-600">Xatolik: {jobState.error}</p>
              )}
            </div>
          )}

          {/* Start button */}
          {!jobState && (
            <button
              onClick={handleStart}
              disabled={!file || fromLang === toLang || isStarting}
              className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isStarting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Yuklanmoqda...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                  Tarjima boshlash
                </>
              )}
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
