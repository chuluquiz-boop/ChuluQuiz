// ChuluQuiz/src/lib/api.js
const ENV_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "";

// إذا ENV_BASE فارغ => نخليها relative (/api/...) باش Vite proxy يخدم في local
export const API_BASE = String(ENV_BASE || "").replace(/\/+$/, "");

// src/lib/api.js
export async function apiFetch(path, options) {
  const url = API_BASE ? `${API_BASE}${path}` : path;

  const res = await fetch(url, options);
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json().catch(() => ({}))
    : await res.text().catch(() => "");

  // ✅ NEW: إذا Unauthorized => نخرّجو المستخدم
  if (res.status === 401) {
    localStorage.removeItem("session_token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");

    // رجّعو لصفحة الدخول (غيّر المسار حسب Routes تاعك)
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }

  if (!res.ok) {
    const msg = typeof data === "string" ? data : (data?.message || "Request failed");
    throw new Error(msg);
  }
  return data;
}