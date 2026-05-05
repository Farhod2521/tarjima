"use client";

import { useEffect, useRef, useState } from "react";
import { getApiUrl } from "@/lib/api";
import { authHeaders } from "@/lib/auth";

const API_URL = getApiUrl();
const MAX_FILE_SIZE_MB = 200;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const LANGS = [
  { value: "uzbek", label: "O'zbek tili" },
  { value: "russian", label: "Rus tili" },
  { value: "english", label: "Ingliz tili" },
];

const FONT_OPTIONS = [
  "Times New Roman",
  "Arial",
  "Calibri",
  "Cambria",
  "Georgia",
  "Aptos",
];

type JobState = {
  status: "pending" | "processing" | "done" | "error";
  progress: number;
  total: number;
  done: number;
  error: string | null;
  filename: string;
};

export default function HujjatTartiblashPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [documentLang, setDocumentLang] = useState("uzbek");
  const [fontFamily, setFontFamily] = useState("Times New Roman");
  const [fontSize, setFontSize] = useState(14);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobState, setJobState] = useState<JobState | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith(".docx")) {
      setErrorMsg("Faqat .docx (Word) fayl qabul qilinadi");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg(`Fayl hajmi ${MAX_FILE_SIZE_MB}MB dan oshmasligi kerak`);
      return;
    }

    setFile(selectedFile);
    setErrorMsg(null);
    setJobId(null);
    setJobState(null);
  };

  const handleStart = async () => {
    if (!file) {
      return;
    }

    setIsStarting(true);
    setErrorMsg(null);
    setJobState(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("document_lang", documentLang);
      fd.append("font_family", fontFamily);
      fd.append("font_size", String(fontSize));

      const res = await fetch(`${API_URL}/document-format/`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      setJobId(data.job_id);
      startSSE(data.job_id);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Xatolik yuz berdi");
    } finally {
      setIsStarting(false);
    }
  };

  const startSSE = (id: string) => {
    esRef.current?.close();

    const es = new EventSource(`${API_URL}/document-format/${id}/progress`);
    esRef.current = es;

    es.onmessage = (event) => {
      const data: JobState = JSON.parse(event.data);
      setJobState(data);
      if (data.status === "done" || data.status === "error") {
        es.close();
      }
      if (data.status === "done") {
        fetch(`${API_URL}/history/formatting`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            filename: data.filename || file?.name || "unknown",
            font: fontFamily,
            font_size: fontSize,
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

  const isDone = jobState?.status === "done";
  const isProcessing =
    isStarting || jobState?.status === "pending" || jobState?.status === "processing";
  const progress = jobState?.progress ?? 0;

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-5 bg-white border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-800">Hujjatni tartiblash</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Tarjimadan keyingi .docx hujjatni punktuatsiya, spacing va shrift bo&apos;yicha
          tozalash
        </p>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto flex flex-col gap-5">
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Matn tili
              </p>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Qaysi tildagi matn tartiblanadi
              </label>
              <select
                value={documentLang}
                onChange={(event) => setDocumentLang(event.target.value)}
                disabled={isProcessing}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {LANGS.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Shrift
              </p>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Shrift family
              </label>
              <select
                value={fontFamily}
                onChange={(event) => setFontFamily(event.target.value)}
                disabled={isProcessing}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                O&apos;lcham
              </p>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Shrift o&apos;lchami
              </label>
              <input
                type="number"
                min={8}
                max={32}
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value) || 14)}
                disabled={isProcessing}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <p className="mt-2 text-xs text-slate-400">Tavsiya: 12-14 pt oralig&apos;i</p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Fayl yuklash
              </p>

              {!file ? (
                <div
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    const droppedFile = event.dataTransfer.files[0];
                    if (droppedFile) {
                      handleFileSelect(droppedFile);
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 py-12 select-none ${
                    isDragging
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50"
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <p className="font-semibold text-slate-700">.docx hujjatni yuklash</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Suring yoki bosing | .docx | maks. {MAX_FILE_SIZE_MB}MB
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx"
                    className="hidden"
                    onChange={(event) => {
                      const selectedFile = event.target.files?.[0];
                      if (selectedFile) {
                        handleFileSelect(selectedFile);
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate text-sm">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  {!isProcessing && (
                    <button
                      onClick={reset}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="bg-slate-900 rounded-2xl shadow-sm p-5 text-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                AI nima qiladi
              </p>
              <div className="flex flex-col gap-3 text-sm leading-6">
                <p>Nuqta, vergul, ikki nuqta va boshqa punktuatsiyani joyiga qo&apos;yadi.</p>
                <p>Ajralib ketgan qo&apos;shimcha va so&apos;z bo&apos;laklarini tiklaydi.</p>
                <p>Katta-kichik harflarni normallashtiradi.</p>
                <p>Bir xil shrift family va o&apos;lchamni butun hujjatga qo&apos;llaydi.</p>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {errorMsg}
            </div>
          )}

          {(isProcessing || isDone) && jobState && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-slate-800 text-sm">
                  {isDone ? "Hujjat tayyor" : "Hujjat tartiblanmoqda"}
                </p>
                <span className={`text-lg font-bold ${isDone ? "text-green-600" : "text-blue-600"}`}>
                  {progress}%
                </span>
              </div>

              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${isDone ? "bg-green-500" : "bg-blue-500"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {!isDone && jobState.total > 0 && (
                <p className="text-xs text-slate-400">
                  {jobState.done} / {jobState.total} paragraf tartiblandi
                </p>
              )}

              {isDone && (
                <div className="mt-4 flex items-center gap-3">
                  <a
                    href={`${API_URL}/document-format/${jobId}/download`}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Tartiblangan hujjatni yuklab olish
                  </a>
                  <button
                    onClick={reset}
                    className="px-4 py-2.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Yangi fayl
                  </button>
                </div>
              )}

              {jobState.status === "error" && (
                <p className="mt-2 text-sm text-red-600">Xatolik: {jobState.error}</p>
              )}
            </div>
          )}

          {!jobState && (
            <button
              onClick={handleStart}
              disabled={!file || isStarting || fontSize < 8 || fontSize > 32}
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m-7 5H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2h-1M9 7h1m4 10l2 2 4-4"
                    />
                  </svg>
                  Tartiblashni boshlash
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
