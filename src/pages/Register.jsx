import { useMemo, useState } from "react";
import bg from "../assets/register-bg.png";
import { formatDZPhone, digitsOnly, isValidPhone10 } from "../utils/phone";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import PartnersHeader from "../components/PartnersHeader.jsx";

export default function Register() {
  const [username, setUsername] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const phoneFormatted = useMemo(() => formatDZPhone(phoneRaw), [phoneRaw]);
  const phoneDigits = useMemo(() => digitsOnly(phoneRaw).slice(0, 10), [phoneRaw]);

  const canSubmit =
    username.trim().length >= 2 &&
    isValidPhone10(phoneDigits) &&
    password.length >= 6 &&
    password === confirm;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!canSubmit) {
      setError("تحقق من البيانات: الاسم، الهاتف 10 أرقام، وكلمتا السر متطابقتان.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          phone: phoneDigits,
          password,
        }),
      });

      setSuccess(
        "تم تقديم طلب تسجيلك بنجاح ✅\nيرجى الانتظار حتى تتم الموافقة عليه.\nشكرًا لك."
      );
      setUsername("");
      setPhoneRaw("");
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(err?.message || "حدث خطأ أثناء التسجيل.");
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

      {/* زر تسجيل الدخول: أقصى الأعلى يسار */}
      <Link
        to="/login"
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
        تسجيل الدخول
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
                  إنشاء حساب
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
                  autoComplete="name"
                />

                <div className="flex flex-col gap-2">
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
                    placeholder="رقم الهاتف"
                    inputMode="numeric"
                    value={phoneFormatted}
                    onChange={(e) => setPhoneRaw(e.target.value)}
                    autoComplete="tel"
                  />
                  <div className="text-center text-xs text-white/80 drop-shadow">
                    {digitsOnly(phoneRaw).length}/10
                  </div>
                </div>

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
                  autoComplete="new-password"
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
                  placeholder="تأكيد كلمة السر"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />

                {error ? (
                  <div className="text-center text-sm text-red-100 bg-red-600/60 rounded-2xl p-3 whitespace-pre-line border border-red-200/30">
                    {error}
                  </div>
                ) : null}

                {success ? (
                  <div className="text-center text-sm text-green-100 bg-green-700/55 rounded-2xl p-3 whitespace-pre-line border border-green-200/25">
                    {success}
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
                  {loading ? "...جاري" : "تسجيل"}
                </button>

                {/* رابط صغير (اختياري) */}
                <div className="text-center text-xs text-white/70">
                  لديك حساب؟{" "}
                  <Link className="underline text-white/90" to="/login">
                    تسجيل الدخول
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