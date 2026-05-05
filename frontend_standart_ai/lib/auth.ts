export type UserRole = "admin" | "director" | "employee";

export type AuthUser = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: UserRole;
  password: string;
  can_grammar: boolean;
  can_tarjima: boolean;
  can_hujjat: boolean;
  created_at?: string;
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auth_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: AuthUser): void {
  localStorage.setItem("auth_token", token);
  localStorage.setItem("auth_user", JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function isAdminOrDirector(user: AuthUser | null): boolean {
  return user?.role === "admin" || user?.role === "director";
}

export function canAccess(
  user: AuthUser | null,
  section: "grammar" | "tarjima" | "hujjat"
): boolean {
  if (!user) return false;
  if (isAdminOrDirector(user)) return true;
  if (section === "grammar") return user.can_grammar;
  if (section === "tarjima") return user.can_tarjima;
  if (section === "hujjat") return user.can_hujjat;
  return false;
}

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 7)
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7)}`;
}
