"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getApiUrl } from "@/lib/api";
import { authHeaders } from "@/lib/auth";

const API_URL = getApiUrl();

// ── Types ─────────────────────────────────────────────────────────────────────

type SystemUser = {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  role: string;
  can_grammar: boolean;
  can_tarjima: boolean;
  can_hujjat: boolean;
  created_at: string;
};

type Employee = {
  id: number;
  full_name: string;
  created_at: string;
};

const ROLE_OPTIONS = [
  { value: "employee", label: "Xodim" },
  { value: "director", label: "Direktor" },
  { value: "admin", label: "Admin" },
];

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  director: "bg-purple-100 text-purple-700",
  employee: "bg-slate-100 text-slate-600",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("uz-UZ", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Toggle button ─────────────────────────────────────────────────────────────

function ToggleBtn({
  active, label, onChange,
}: { active: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!active)}
      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
        active
          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
          : "bg-slate-50 border-slate-200 text-slate-400"
      }`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${active ? "bg-emerald-500" : "bg-slate-300"}`} />
      {label}
    </button>
  );
}

// ── Tab 1: Registered users ───────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/users/`, { headers: authHeaders(), cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setUsers(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function updatePermissions(userId: number, perms: Partial<SystemUser>) {
    setUpdating(userId);
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    try {
      const body = {
        can_grammar: perms.can_grammar ?? user.can_grammar,
        can_tarjima: perms.can_tarjima ?? user.can_tarjima,
        can_hujjat: perms.can_hujjat ?? user.can_hujjat,
      };
      const res = await fetch(`${API_URL}/users/${userId}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated: SystemUser = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch {
      fetchUsers();
    } finally {
      setUpdating(null);
    }
  }

  async function updateRole(userId: number, role: string) {
    setUpdating(userId);
    try {
      const res = await fetch(`${API_URL}/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated: SystemUser = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch {
      fetchUsers();
    } finally {
      setUpdating(null);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
      <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
      <span className="text-sm">Yuklanmoqda...</span>
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm m-4">
      {error}
      <button onClick={fetchUsers} className="ml-auto underline">Qayta urinish</button>
    </div>
  );

  if (users.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
      <p className="font-medium">Foydalanuvchilar yo'q</p>
      <p className="text-sm mt-1">Ro'yxatdan o'tgan xodimlar bu yerda ko'rinadi</p>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">№</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Xodim</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Grammatik Tahlil</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tarjima</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Hujjat Tartiblash</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qo'shilgan</th>
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((user, idx) => {
            const busy = updating === user.id;
            return (
              <tr key={user.id} className={`hover:bg-slate-50 transition-colors ${busy ? "opacity-60" : ""}`}>
                <td className="px-4 py-3.5 text-slate-400 font-mono text-xs">{idx + 1}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-700 font-bold text-xs">
                        {user.first_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{user.first_name} {user.last_name}</p>
                      <p className="text-xs text-slate-400">{user.phone}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <select
                    value={user.role}
                    disabled={busy}
                    onChange={(e) => updateRole(user.id, e.target.value)}
                    className={`text-xs font-semibold px-2 py-1 rounded-lg border cursor-pointer focus:outline-none ${ROLE_COLORS[user.role] ?? "bg-slate-100 text-slate-600"} border-transparent`}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3.5">
                  <ToggleBtn
                    active={user.can_grammar}
                    label={user.can_grammar ? "Yoqilgan" : "O'chirilgan"}
                    onChange={(v) => updatePermissions(user.id, { can_grammar: v })}
                  />
                </td>
                <td className="px-4 py-3.5">
                  <ToggleBtn
                    active={user.can_tarjima}
                    label={user.can_tarjima ? "Yoqilgan" : "O'chirilgan"}
                    onChange={(v) => updatePermissions(user.id, { can_tarjima: v })}
                  />
                </td>
                <td className="px-4 py-3.5">
                  <ToggleBtn
                    active={user.can_hujjat}
                    label={user.can_hujjat ? "Yoqilgan" : "O'chirilgan"}
                    onChange={(v) => updatePermissions(user.id, { can_hujjat: v })}
                  />
                </td>
                <td className="px-4 py-3.5 text-xs text-slate-400">
                  {formatDate(user.created_at)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Link
                    href={`/dashboard/xodimlar/${user.id}`}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all inline-flex"
                    title="Batafsil"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab 2: Employees (reports) ────────────────────────────────────────────────

function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  async function fetchEmployees() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/employees/`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEmployees(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchEmployees(); }, []);

  async function handleAdd() {
    if (!fullName.trim()) { setSaveError("Ism kiritilmadi"); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`${API_URL}/employees/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName.trim() }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail ?? `HTTP ${res.status}`); }
      const emp: Employee = await res.json();
      setEmployees((prev) => [emp, ...prev]);
      setModalOpen(false);
      setFullName("");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeleteId(id);
    try {
      const res = await fetch(`${API_URL}/employees/${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail ?? `HTTP ${res.status}`); }
      await fetchEmployees();
    } catch (e) {
      setError(e instanceof Error ? e.message : "O'chirishda xatolik");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div>
      {/* Sub-header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-xl">
          <span className="text-sm font-semibold text-blue-700">Jami: {employees.length} xodim</span>
        </div>
        <button
          onClick={() => { setModalOpen(true); setSaveError(null); setFullName(""); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yangi xodim qo'shish
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm m-4">
          {error}
          <button onClick={fetchEmployees} className="ml-auto underline">Qayta urinish</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
          <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
          <span className="text-sm">Yuklanmoqda...</span>
        </div>
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
          <p className="font-medium">Xodimlar ro'yxati bo'sh</p>
          <p className="text-sm mt-1">Yangi xodim qo'shish uchun tugmani bosing</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-12">№</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ism Familiya</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qo'shilgan vaqt</th>
              <th className="px-6 py-3.5 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((emp, idx) => (
              <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4 text-slate-400 font-mono text-xs">{idx + 1}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-700 font-semibold text-xs">{emp.full_name.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="font-medium text-slate-800">{emp.full_name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-400 text-xs">{formatDate(emp.created_at)}</td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleDelete(emp.id)}
                    disabled={deleteId === emp.id}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                  >
                    {deleteId === emp.id ? (
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

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">Yangi xodim qo'shish</h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">Ism va Familiya</label>
              <input
                type="text" value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Masalan: Alisher Navoiy"
                autoFocus
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {saveError && <p className="mt-2 text-xs text-red-600">{saveError}</p>}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                Bekor qilish
              </button>
              <button
                onClick={handleAdd} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                Qo'shish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function XodimlarPage() {
  const [activeTab, setActiveTab] = useState<"users" | "employees">("users");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-5 bg-white border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-800">Xodimlar</h1>
        <p className="text-slate-500 text-sm mt-0.5">Tizim foydalanuvchilari va xodimlar boshqaruvi</p>
      </div>

      {/* Tabs */}
      <div className="px-8 pt-4 bg-white border-b border-slate-200">
        <div className="flex gap-1">
          {([
            { key: "users", label: "Ro'yxatdan o'tganlar", icon: "👤" },
            { key: "employees", label: "Hisobot xodimlari", icon: "📋" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-700 bg-blue-50/50"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="bg-white rounded-b-none min-h-full">
          {activeTab === "users" ? <UsersTab /> : <EmployeesTab />}
        </div>
      </div>
    </div>
  );
}
