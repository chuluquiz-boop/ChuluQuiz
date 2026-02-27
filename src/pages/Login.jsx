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

      // (اختياري) بعض المشاريع تستعمل quiz_token
      if (json.token) localStorage.setItem("quiz_token", json.token);

      // هذا هو الأهم عندك
      if (!json.session_token) throw new Error("session_token غير موجود من السيرفر");
      localStorage.setItem("session_token", json.session_token);

      if (json.user_id != null) localStorage.setItem("user_id", String(json.user_id));
      if (json.username) localStorage.setItem("username", json.username);

      // ✅ (جديد) خزّن رقم الهاتف إذا رجّعو السيرفر
      // لازم backend يرجّع: phone: user.phone
      if (json.phone != null) localStorage.setItem("phone", String(json.phone));
      else localStorage.removeItem("phone"); // تنظيف في حال ما كانش راجع

      // (اختياري) إذا backend يرجّع role/state
      if (json.role != null) localStorage.setItem("role", String(json.role));
      if (json.state != null) localStorage.setItem("state", String(json.state));

      navigate("/quiz");
    } catch (err) {
      setError(err?.message || "حدث خطأ أثناء تسجيل الدخول.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen w-full bg-center bg-cover relative flex flex-col"
      style={{ backgroundImage: `url(${bg})` }}
      dir="rtl"
    >
      {/* Gradient glow خفيف */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/10" />

      {/* زر إنشاء حساب: أقصى الأعلى يسار */}
      <Link
        to="/register"
        className="
          absolute top-4 left-4 z-50
          rounded-2xl
          px-4 py-2
          text-sm sm:text-base font-semibold
          text-slate-900
          bg-white/15 backdrop-blur-xl
          border border-white/25
          shadow-[0_10px_30px_rgba(0,0,0,0.18)]
          hover:bg-white/25 hover:border-white/35
          active:scale-[0.98]
          transition
        "
      >
        إنشاء حساب
      </Link>

      {/* الهيدر في المنتصف بالأعلى */}
      <div className="w-full flex justify-center pt-5 sm:pt-6 px-3 relative z-10">
        <PartnersHeader />
      </div>

      {/* محتوى الصفحة */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <form onSubmit={onSubmit} className="w-full max-w-md">
          {/* Glass Card للفورم */}
          <div className="rounded-[26px] p-[1px] bg-gradient-to-r from-white/35 via-white/10 to-white/35 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <div className="rounded-[25px] bg-white/12 backdrop-blur-2xl border border-white/15 p-6 sm:p-7">
              <div className="flex flex-col gap-4">
                <h1 className="text-center text-white font-extrabold text-xl sm:text-2xl drop-shadow">
                  تسجيل الدخول
                </h1>

                <input
                  className="
                    h-14 rounded-2xl
                    bg-white/85
                    px-6
                    text-center text-lg
                    shadow
                    outline-none
                    border border-white/40
                    focus:border-white/70
                  "
                  placeholder="اسم المستخدم"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />

                <input
                  className="
                    h-14 rounded-2xl
                    bg-white/85
                    px-6
                    text-center text-lg
                    shadow
                    outline-none
                    border border-white/40
                    focus:border-white/70
                  "
                  placeholder="كلمة السر"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />

                {error ? (
                  <div className="text-center text-sm text-red-100 bg-red-600/60 rounded-2xl p-3 whitespace-pre-line border border-red-200/30">
                    {error}
                  </div>
                ) : null}

                <button
                  disabled={!canSubmit || loading}
                  className="
                    h-14 rounded-2xl
                    bg-black/85 text-white text-lg font-semibold
                    shadow-[0_18px_45px_rgba(0,0,0,0.28)]
                    border border-white/10
                    hover:bg-black/90
                    disabled:opacity-50
                    transition
                  "
                  type="submit"
                >
                  {loading ? "...جاري" : "دخول"}
                </button>

                {/* رابط صغير (اختياري) */}
                <div className="text-center text-xs text-white/70">
                  ليس لديك حساب؟{" "}
                  <Link className="underline text-white/90" to="/register">
                    إنشاء حساب
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}