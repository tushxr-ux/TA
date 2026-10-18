export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://ta-production-68db.up.railway.app/api/v1";

export const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, "");

export function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
