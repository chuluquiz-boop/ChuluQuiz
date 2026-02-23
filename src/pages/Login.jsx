import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import bg from "../assets/register-bg.png";
import { apiFetch } from "../lib/api";
import PartnersHeader from "../components/PartnersHeader.jsx";

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = username.trim().length >= 2 && password.length >= 6;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("تحقق من البيانات: الاسم وكلمة السر.");
      return;
    }

    setLoading(true);
    try {
      const json = await apiFetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      localStorage.setItem("quiz_token", json.token);

      if (!json.session_token) throw new Error("session_token غير موجود من السيرفر");
      localStorage.setItem("session_token", json.session_token);

      if (json.user_id != null) localStorage.setItem("user_id", String(json.user_id));
      if (json.username) localStorage.setItem("username", json.username);

      navigate("/quiz");
    } catch (err) {
      setError(err?.message || "حدث خطأ أثناء تسجيل الدخول.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative min-h-screen w-full bg-center bg-cover flex items-center justify-center p-4"
      style={{ backgroundImage: `url(${bg})` }}
      dir="rtl"
    >
      {/* ✅ Partners Header */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 px-3">
        <PartnersHeader />
      </div>

      <Link
        to="/register"
        className="absolute top-6 right-6 rounded-xl border-2 border-white/80 bg-white/30 px-6 py-2 text-base font-medium text-gray-900 backdrop-blur-sm shadow"
      >
        إنشاء حساب
      </Link>

      <form onSubmit={onSubmit} className="w-full max-w-md flex flex-col gap-6">
        <input
          className="h-14 rounded-2xl bg-white/90 px-6 text-center text-lg shadow outline-none"
          placeholder="اسم المستخدم"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />

        <input
          className="h-14 rounded-2xl bg-white/90 px-6 text-center text-lg shadow outline-none"
          placeholder="كلمة السر"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {error ? (
          <div className="text-center text-sm text-red-100 bg-red-600/60 rounded-xl p-3 whitespace-pre-line">
            {error}
          </div>
        ) : null}

        <button
          disabled={!canSubmit || loading}
          className="h-14 rounded-2xl bg-black/90 text-white text-lg shadow disabled:opacity-50"
        >
          {loading ? "...جاري" : "دخول"}
        </button>
      </form>
    </div>
  );
}