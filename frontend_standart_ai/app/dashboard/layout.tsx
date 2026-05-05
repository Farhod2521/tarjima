"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getToken, getUser, type AuthUser } from "@/lib/auth";
import { getApiUrl } from "@/lib/api";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = getToken();
    const storedUser = getUser();
    if (!token || !storedUser) {
      router.replace("/login");
      return;
    }
    // Har safar dashboardga kirganda serverdan yangi ruxsatlarni olish
    fetch(`${getApiUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((fresh) => {
        if (fresh) {
          localStorage.setItem("auth_user", JSON.stringify(fresh));
          setUser(fresh);
        } else {
          setUser(storedUser);
        }
      })
      .catch(() => setUser(storedUser))
      .finally(() => setChecked(true));
  }, [router]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="flex-1 flex flex-col bg-slate-50 overflow-hidden h-screen">
        {children}
      </main>
    </div>
  );
}
