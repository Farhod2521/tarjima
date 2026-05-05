"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { getApiUrl } from "@/lib/api";
import { authHeaders, getUser } from "@/lib/auth";


const API_URL = getApiUrl();
const MAX_FILE_SIZE_MB = 200;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ── Types ─────────────────────────────────────────────────────────────────────

type Issue = {
  issue_id: string;
  issue_type:
    | "spelling"
    | "apostrophe"
    | "mixed_alphabet"
    | "encoding"
    | "grammar"
    | "punctuation"
    | "style"
    | "capitalization"
    | string;
  severity: "low" | "medium" | "high";
  original_text: string;
  corrected_text: string;
  sentence: string;
  suggestion: string;
  explanation: string;
  paragraph_index: number | null;
  page_number: number | null;
  char_start: number | null;
  char_end: number | null;
};

// Bir xil xatolar guruhlangan tur
type GroupedIssue = {
  key: string;
  issue: Issue;               // birinchi uchrashuv
  count: number;              // necha marta
  pages: number[];            // qaysi PDF sahifalarda
};

type ChunkResult = {
  chunk_index: number;
  paragraph_index_start: number;
  paragraph_index_end: number;
  original_text: string;
  corrected_text: string;
  issues: Issue[];
};

type AnalysisResponse = {
  success: boolean;
  file_name: string;
  file_type: "pdf" | "docx";
  processing_time_ms: number;
  metadata: {
    page_count: number;
    paragraph_count: number;
    word_count: number;
    char_count: number;
  };
  summary: {
    total_chunks: number;
    total_issues: number;
    issue_counts: {
      grammar: number;
      spelling: number;
      apostrophe: number;
      mixed_alphabet: number;
      encoding: number;
      punctuation: number;
      style: number;
      capitalization: number;
    };
  };
  corrected_text: string;
  chunks: ChunkResult[];
  warnings: string[];
  file_id?: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const ISSUE_TYPE_LABELS: Record<string, string> = {
  grammar: "Grammatika",
  spelling: "Imlo",
  apostrophe: "Apostrof",
  mixed_alphabet: "Lotin/Kirill",
  encoding: "Encoding",
  punctuation: "Tinish",
  style: "Uslub",
  capitalization: "Harf",
};


const ISSUE_TYPE_COLOR: Record<string, string> = {
  grammar:       "bg-blue-100 text-blue-700",
  spelling:      "bg-purple-100 text-purple-700",
  apostrophe:     "bg-yellow-100 text-yellow-700",
  mixed_alphabet: "bg-orange-100 text-orange-700",
  encoding:       "bg-red-100 text-red-700",
  punctuation:   "bg-pink-100 text-pink-700",
  style:         "bg-teal-100 text-teal-700",
  capitalization:"bg-indigo-100 text-indigo-700",
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Barcha chunk'lardan xatolarni olib, bir xillarini guruhlaydi */
function groupIssues(chunks: ChunkResult[]): GroupedIssue[] {
  const map = new Map<string, GroupedIssue>();
  for (const chunk of chunks) {
    for (const issue of chunk.issues) {
      const key = `${issue.issue_type}::${issue.original_text}::${issue.corrected_text}`;
      if (map.has(key)) {
        const g = map.get(key)!;
        g.count++;
        if (issue.page_number && !g.pages.includes(issue.page_number)) {
          g.pages.push(issue.page_number);
        }
      } else {
        map.set(key, {
          key,
          issue,
          count: 1,
          pages: issue.page_number ? [issue.page_number] : [],
        });
      }
    }
  }
  // Eng ko'p takrorganlari birinchi
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GrammarPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("spelling");
  const pdfBlobUrl = useRef<string | null>(null);
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelEndRef = useRef<HTMLDivElement>(null);

  // Hisobot uchun
  const currentUser   = getUser();
  const selectedEmployee = currentUser
    ? `${currentUser.first_name} ${currentUser.last_name}`
    : "";
  const [standardName, setStandardName] = useState<string>("");
  const [reportSaved, setReportSaved]   = useState(false);

  // Deduplicated va grouped xatolar
  const groupedIssues = useMemo(
    () => (result ? groupIssues(result.chunks) : []),
    [result]
  );

  const handleFileSelect = (f: File) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(f.type) && !f.name.match(/\.(pdf|docx)$/i)) {
      setErrorMsg("Faqat PDF yoki Word (.docx) fayllar qabul qilinadi");
      return;
    }
    if (f.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg(`Fayl hajmi ${MAX_FILE_SIZE_MB}MB dan oshmasligi kerak`);
      return;
    }
    // Oldingi blob URL ni tozalash
    if (pdfBlobUrl.current) URL.revokeObjectURL(pdfBlobUrl.current);
    pdfBlobUrl.current = f.type === "application/pdf" ? URL.createObjectURL(f) : null;

    setFile(f);
    setResult(null);
    setErrorMsg(null);
    setActivePage(null);
  };

  // DOCX faylni docx-preview bilan render qilish
  useEffect(() => {
    if (!file || file.type === "application/pdf") return;
    const container = docxContainerRef.current;
    if (!container) return;
    container.innerHTML = "";
    import("docx-preview").then(({ renderAsync }) => {
      renderAsync(file, container, undefined, {
        className: "docx-preview",
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
      }).catch(() => {});
    });
  }, [file]);

  // Xato so'zga bosilganda sahifaga o'tish
  const goToPage = (page: number | null) => {
    if (!page) return;
    if (pdfBlobUrl.current) {
      // PDF: iframe page navigation
      setActivePage(page);
    } else if (docxContainerRef.current) {
      // DOCX: docx-preview .docx-wrapper ichidagi .page elementlarga scroll
      const pages = docxContainerRef.current.querySelectorAll<HTMLElement>(
        ".docx-wrapper section, .docx section, [class*='page']"
      );
      const target = pages[page - 1];
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, []);

  const removeFile = () => {
    if (pdfBlobUrl.current) {
      URL.revokeObjectURL(pdfBlobUrl.current);
      pdfBlobUrl.current = null;
    }
    setFile(null);
    setResult(null);
    setErrorMsg(null);
    setActivePage(null);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_URL}/analyze-document`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({ detail: "Xatolik" }));
        throw new Error(d.detail ?? `HTTP ${res.status}`);
      }

      const data: AnalysisResponse = await res.json();
      setResult(data);
      setReportSaved(false);
      if (selectedEmployee && standardName.trim()) {
        await saveReport(data, selectedEmployee, standardName.trim());
      }
      fetch(`${API_URL}/history/grammar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          filename: file.name,
          standard_name: standardName.trim() || null,
          issues_count: data.summary.total_issues,
          file_id: data.file_id ?? null,
        }),
      }).catch(() => {});
      setTimeout(() => panelEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Noma'lum xatolik");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveReport = async (data: AnalysisResponse, empName: string, stdName: string) => {
    // Hisobotga barcha aniqlangan korrektura xatolarini yozamiz
    const issues = groupIssues(data.chunks)
      .map((g) => ({
        original: g.issue.original_text,
        corrected: g.issue.corrected_text,
        page: g.pages[0] ?? null,
      }));
    try {
      await fetch(`${API_URL}/reports/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_name: empName, standard_name: stdName, issues }),
      });
      setReportSaved(true);
    } catch {
      // Hisobotni saqlashda xato — tahlilga ta'sir qilmasin
    }
  };

  const handleDownload = (format: "pdf" | "docx") => {
    if (!result) return;
    // corrected_text ni blob sifatida yuklab olamiz
    const blob = new Blob([result.corrected_text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tuzatilgan_hujjat.${format === "pdf" ? "txt" : "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalIssues = result?.summary.total_issues ?? 0;
  const isPdf = file?.type === "application/pdf";

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-8 py-5 bg-white border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-800">Korrektura Xatolarini Tekshirish</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          PDF yoki Word hujjatini yuklang. AI aniq imlo, grammatika va tinish xatolarini tekshiradi
        </p>
      </div>

      {/* ── Main: col-8 + col-4 ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── col-8: Upload + Preview ── */}
        <div className="flex flex-col flex-[2] p-6 overflow-auto border-r border-slate-200 gap-4">

          {/* Hisobot sozlamalari */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Hisobot sozlamalari (ixtiyoriy)
            </p>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Xodim</label>
                <div className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium">
                  {selectedEmployee || "—"}
                </div>
              </div>
              <div className="flex-[2]">
                <label className="block text-xs font-medium text-slate-600 mb-1">Standart nomi</label>
                <input
                  type="text"
                  value={standardName}
                  onChange={(e) => setStandardName(e.target.value)}
                  placeholder="Masalan: O'zDSt 1234:2023"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {reportSaved && (
              <p className="mt-2 text-xs text-green-600 font-medium">
                ✓ Hisobot saqlandi — Xodimlar hisobati bo'limida ko'ring
              </p>
            )}
          </div>

          {/* Drop zone */}
          {!file ? (
            <div
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 min-h-72 select-none
                ${isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50"}`}
            >
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-slate-700">
                {isDragging ? "Faylni bu yerga tashlang" : "Faylni yuklash"}
              </p>
              <p className="text-sm text-slate-500 mt-1">Suring yoki bosing · PDF, DOCX · maks. {MAX_FILE_SIZE_MB}MB</p>
              <div className="flex gap-3 mt-4">
                <span className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium">PDF</span>
                <span className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-600 font-medium">DOCX</span>
              </div>
              <input
                ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* File header */}
              <div className="flex items-center gap-4 p-5 border-b border-slate-100">
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 ${isPdf ? "bg-red-50" : "bg-blue-50"}`}>
                  <svg className={`w-6 h-6 ${isPdf ? "text-red-500" : "text-blue-500"}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{file.name}</p>
                  <p className="text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                {!isAnalyzing && (
                  <button onClick={removeFile} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>

              {/* PDF Preview / DOCX render */}
              {isPdf ? (
                <iframe
                  key={activePage ?? 0}
                  src={`${pdfBlobUrl.current}${activePage ? `#page=${activePage}` : ""}`}
                  className="w-full"
                  style={{ height: 460 }}
                  title="PDF"
                />
              ) : (
                <div
                  ref={docxContainerRef}
                  className="w-full overflow-auto bg-slate-100"
                  style={{ height: 460 }}
                />
              )}
            </div>
          )}

          {/* Analyzing spinner */}
          {isAnalyzing && (
            <div className="bg-white rounded-2xl border border-blue-100 p-6 flex items-center gap-4">
              <div className="relative w-10 h-10 flex-shrink-0">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100"/>
                <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"/>
              </div>
              <div>
                <p className="font-medium text-slate-800">AI tahlil qilmoqda...</p>
                <p className="text-slate-500 text-sm mt-0.5">Barcha bo'laklar parallel yuborilmoqda</p>
              </div>
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {errorMsg}
            </div>
          )}

          {/* Result metadata */}
          {result && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800">Tahlil natijalari</h2>
                <span className="text-xs text-slate-400">{formatMs(result.processing_time_ms)}</span>
              </div>
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Sahifalar", val: result.metadata.page_count || "—" },
                  { label: "Paragraflar", val: result.metadata.paragraph_count },
                  { label: "So'zlar", val: result.metadata.word_count.toLocaleString() },
                  { label: "Bo'laklar", val: result.summary.total_chunks },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-slate-800">{s.val}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Issue type breakdown */}
              {totalIssues > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.summary.issue_counts).map(([type, count]) =>
                    count > 0 ? (
                      <span key={type} className={`px-2.5 py-1 rounded-lg text-xs font-medium ${ISSUE_TYPE_COLOR[type] ?? "bg-slate-100 text-slate-600"}`}>
                        {ISSUE_TYPE_LABELS[type] ?? type}: {count}
                      </span>
                    ) : null
                  )}
                </div>
              )}

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {result.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      ⚠️ {w}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── col-4: Tabbed error panel ── */}
        <ErrorPanel
          isAnalyzing={isAnalyzing}
          result={result}
          groupedIssues={groupedIssues}
          totalIssues={totalIssues}
          activeTab={activeTab}
          setActiveTab={(t: string) => setActiveTab(t)}
          onPageClick={goToPage}
          panelEndRef={panelEndRef}
        />
      </div>

      {/* ── Bottom action bar ── */}
      <div className="bg-white border-t border-slate-200 px-8 py-4 flex items-center gap-3 flex-wrap">
        {/* Analyze */}
        <button
          onClick={handleAnalyze}
          disabled={!file || isAnalyzing}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isAnalyzing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Tahlil qilinmoqda...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              Korrektura Tahlil
            </>
          )}
        </button>

        {/* Download */}
        {result && totalIssues > 0 && (
          <>
            <button
              onClick={() => handleDownload("pdf")}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              To'g'irlandi · Yuklab Olish
            </button>
          </>
        )}

        {/* Stats */}
        {result && (
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
            <span>{result.file_name}</span>
            <span>·</span>
            <span>{totalIssues} xato</span>
            <span>·</span>
            <span>{formatMs(result.processing_time_ms)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab config (har bir xato turi alohida tab) ────────────────────────────────

const ERROR_TYPE_CONFIG: Record<string, { label: string; emptyMsg: string }> = {
  spelling:       { label: "Imlo",        emptyMsg: "Imlo xatosi topilmadi" },
  apostrophe:     { label: "Apostrof",    emptyMsg: "Apostrof xatosi topilmadi" },
  mixed_alphabet: { label: "Lotin/Kirill",emptyMsg: "Lotin/Kirill aralashuvi topilmadi" },
  encoding:       { label: "Encoding",    emptyMsg: "Encoding xatosi topilmadi" },
  grammar:        { label: "Grammatika",  emptyMsg: "Grammatika xatosi topilmadi" },
  punctuation:    { label: "Tinish",      emptyMsg: "Tinish belgisi xatosi topilmadi" },
  capitalization: { label: "Harf",        emptyMsg: "Harf xatosi topilmadi" },
  style:          { label: "Uslub",       emptyMsg: "Uslub xatosi topilmadi" },
};

// Tablar qaysi tartibda chiqsin
const TAB_ORDER = [
  "spelling", "apostrophe", "mixed_alphabet", "encoding",
  "grammar", "punctuation", "capitalization", "style",
];

// ── ErrorPanel component ──────────────────────────────────────────────────────

function ErrorPanel({
  isAnalyzing,
  result,
  groupedIssues,
  totalIssues,
  activeTab,
  setActiveTab,
  onPageClick,
  panelEndRef,
}: {
  isAnalyzing: boolean;
  result: AnalysisResponse | null;
  groupedIssues: GroupedIssue[];
  totalIssues: number;
  activeTab: string;
  setActiveTab: (t: string) => void;
  onPageClick: (page: number | null) => void;
  panelEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  // Natijada mavjud bo'lgan xato turlarini TAB_ORDER tartibida chiqar
  const presentTypes = TAB_ORDER.filter((t) =>
    groupedIssues.some((g) => g.issue.issue_type === t)
  );
  // Noma'lum turlar (TAB_ORDER da yo'q) oxirga qo'shiladi
  const unknownTypes = [...new Set(groupedIssues.map((g) => g.issue.issue_type))]
    .filter((t) => !TAB_ORDER.includes(t));
  const tabs = [...presentTypes, ...unknownTypes];

  // Agar activeTab mavjud bo'lmasa — birinchisini tanlash
  const currentType = tabs.includes(activeTab) ? activeTab : (tabs[0] ?? "spelling");
  const filtered = groupedIssues.filter((g) => g.issue.issue_type === currentType);
  const currentConfig = ERROR_TYPE_CONFIG[currentType] ?? {
    label: currentType,
    emptyMsg: `${currentType} xatosi topilmadi`,
  };

  return (
    <div className="flex flex-col w-[400px] bg-white border-l border-slate-200 overflow-hidden flex-shrink-0">
      {/* Panel header */}
      <div className="px-4 pt-4 pb-0 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-800 text-sm">Xatolar Tahlili</h2>
          {result && (
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
              totalIssues === 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}>
              {totalIssues === 0 ? "✓ Toza" : `Jami: ${totalIssues}`}
            </span>
          )}
        </div>

        {/* Dinamik tablar — faqat xato bor turlar chiqadi */}
        <div className="flex gap-0.5 flex-wrap">
          {result && tabs.length > 0 ? tabs.map((type) => {
            const cfg = ERROR_TYPE_CONFIG[type] ?? { label: type };
            const count = groupedIssues.filter((g) => g.issue.issue_type === type).length;
            const isActive = currentType === type;
            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                  isActive
                    ? "border-blue-500 text-blue-700 bg-blue-50"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                {cfg.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive ? "bg-blue-200 text-blue-800" : "bg-slate-200 text-slate-600"
                }`}>
                  {count}
                </span>
              </button>
            );
          }) : (
            // Natija yo'q — placeholder tablar
            ["Imlo", "Apostrof", "Lotin/Kirill", "Encoding"].map((label) => (
              <span key={label} className="px-3 py-2 text-xs text-slate-300 border-b-2 border-transparent">
                {label}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">

        {/* Idle */}
        {!isAnalyzing && !result && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <p className="text-slate-500 text-sm font-medium">Tahlil boshlanmagan</p>
            <p className="text-slate-400 text-xs mt-1">Fayl yuklang va boshlang</p>
          </div>
        )}

        {/* Loading */}
        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center h-full py-12 gap-4">
            <div className="w-10 h-10 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin"/>
            <p className="text-slate-600 text-sm font-medium text-center">
              Parallel tahlil<br/>
              <span className="text-slate-400 text-xs">Biroz kuting...</span>
            </p>
          </div>
        )}

        {/* No errors at all */}
        {result && totalIssues === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <p className="text-green-700 font-semibold">Xato topilmadi!</p>
            <p className="text-slate-400 text-xs mt-1">Hujjat to'g'ri yozilgan</p>
          </div>
        )}

        {/* Tab empty state */}
        {result && totalIssues > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <p className="text-slate-400 text-sm">✓ {currentConfig.emptyMsg}</p>
          </div>
        )}

        {/* Numbered list of errors */}
        {result && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((g, idx) => (
              <ErrorListItem
                key={g.key}
                number={idx + 1}
                grouped={g}
                onPageClick={onPageClick}
              />
            ))}
          </div>
        )}

        <div ref={panelEndRef} />
      </div>
    </div>
  );
}

// ── Error list item ───────────────────────────────────────────────────────────

function ErrorListItem({
  number,
  grouped,
  onPageClick,
}: {
  number: number;
  grouped: GroupedIssue;
  onPageClick: (page: number | null) => void;
}) {
  const { issue, count, pages } = grouped;
  const looksIdentical = issue.original_text === issue.corrected_text;

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
      {/* Numbered header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-100">
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-700 text-white text-[10px] font-bold flex-shrink-0">
          {number}
        </span>
        {count > 1 && (
          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px] font-bold">
            ×{count} marta
          </span>
        )}
        {looksIdentical && (
          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-medium">
            belgi farqli
          </span>
        )}
      </div>

      <div className="px-3 py-2.5 space-y-2">
        {/* xato → togri */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => pages[0] && onPageClick(pages[0])}
            className={`group flex items-center gap-1 font-mono text-xs px-2 py-1 rounded-lg bg-red-100 border border-red-200 text-red-700
              ${pages[0] ? "cursor-pointer hover:bg-red-200 transition-colors" : "cursor-default"}`}
            title={pages[0] ? `${pages[0]}-betga o'tish` : undefined}
          >
            <AnnotatedText text={issue.original_text} highlight />
            <span className="text-red-400 ml-0.5 font-normal line-through">❌</span>
          </button>

          <span className="text-slate-400 font-bold text-sm">→</span>

          <span className="flex items-center gap-1 font-mono text-xs px-2 py-1 rounded-lg bg-green-100 border border-green-200 text-green-700">
            <AnnotatedText text={issue.corrected_text} highlight={false} />
            <span className="text-green-500 ml-0.5">✅</span>
          </span>
        </div>

        {/* Betlar */}
        {pages.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 text-[11px]">Bet:</span>
            {pages.sort((a, b) => a - b).map((p) => (
              <button
                key={p}
                onClick={() => onPageClick(p)}
                className="px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 cursor-pointer"
              >
                {p}-bet
              </button>
            ))}
          </div>
        )}

        {/* Apostrof: ikki variant vizual bir xil */}
        {looksIdentical && (
          <div className="text-[11px] text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1.5 leading-relaxed">
            <span className="font-semibold">Ko'rinishi bir xil, lekin Unicode farqli!</span>
            {" "}Noto'g'ri apostrof belgisi (<code className="bg-yellow-100 px-0.5 rounded font-mono">ʻ</code>) → to'g'ri: <code className="bg-green-100 px-0.5 rounded font-mono">'</code> (U+0027)
          </div>
        )}

        {/* Tushuntirish */}
        <p className="text-slate-500 text-[11px] leading-relaxed">{issue.explanation}</p>
      </div>
    </div>
  );
}

// ── Issue row component ───────────────────────────────────────────────────────

/** So'zdagi noto'g'ri Unicode belgilarini [U+XXXX] ko'rinishda belgilab ko'rsatadi */
function AnnotatedText({ text, highlight }: { text: string; highlight?: boolean }) {
  const INVISIBLE_APOSTROPHES = new Set([0x02BC, 0x02BB, 0x2018, 0x2019, 0x0060, 0x00B4]);
  const parts: React.ReactNode[] = [];

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (INVISIBLE_APOSTROPHES.has(code)) {
      parts.push(
        <span
          key={i}
          className="inline-flex items-center px-0.5 bg-yellow-200 text-yellow-800 rounded text-[9px] font-mono font-bold mx-0.5"
          title={`Noto'g'ri belgi: U+${code.toString(16).toUpperCase().padStart(4, "0")}`}
        >
          {text[i]}❌
        </span>
      );
    } else {
      // consecutive normal chars
      if (parts.length > 0 && typeof parts[parts.length - 1] === "string") {
        parts[parts.length - 1] = (parts[parts.length - 1] as string) + text[i];
      } else {
        parts.push(text[i]);
      }
    }
  }

  return (
    <span className={`font-mono px-1.5 py-0.5 rounded text-[11px] ${highlight ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700 font-semibold"}`}>
      {parts}
    </span>
  );
}
