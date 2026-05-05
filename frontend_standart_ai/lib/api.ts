const DEFAULT_API_PORT = "8000";

export function getApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (configured && configured !== "auto") {
    return configured.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${DEFAULT_API_PORT}`;
  }

  return `http://localhost:${DEFAULT_API_PORT}`;
}
