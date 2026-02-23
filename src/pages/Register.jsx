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

      setSuccess("تم تقديم طلب تسجيلك بنجاح ✅\nيرجى الانتظار حتى تتم الموافقة عليه.\nشكرًا لك.");
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
      className="relative min-h-screen w-full bg-center bg-cover flex items-center justify-center p-4"
      style={{ backgroundImage: `url(${bg})` }}
      dir="rtl"
    >
      {/* ✅ Partners Header */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 px-3">
        <PartnersHeader />
      </div>

      <Link
        to="/login"
        className="absolute top-6 right-6 rounded-xl border-2 border-white/80 bg-white/30 px-6 py-2 text-base font-medium text-gray-900 backdrop-blur-sm shadow"
      >
        تسجيل الدخول
      </Link>

      <form onSubmit={onSubmit} className="w-full max-w-md flex flex-col gap-6">
        <input
          className="h-14 rounded-2xl bg-white/90 px-6 text-center text-lg shadow outline-none"
          placeholder="اسم المستخدم"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="name"
        />

        <div className="flex flex-col gap-2">
          <input
            className="h-14 rounded-2xl bg-white/90 px-6 text-center text-lg shadow outline-none"
            placeholder="رقم الهاتف"
            inputMode="numeric"
            value={phoneFormatted}
            onChange={(e) => setPhoneRaw(e.target.value)}
            autoComplete="tel"
          />
          <div className="text-center text-xs text-white/90 drop-shadow">
            {digitsOnly(phoneRaw).length}/10
          </div>
        </div>

        <input
          className="h-14 rounded-2xl bg-white/90 px-6 text-center text-lg shadow outline-none"
          placeholder="كلمة السر"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />

        <input
          className="h-14 rounded-2xl bg-white/90 px-6 text-center text-lg shadow outline-none"
          placeholder="تأكيد كلمة السر"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />

        {error ? (
          <div className="text-center text-sm text-red-100 bg-red-600/60 rounded-xl p-3">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="text-center text-sm text-green-100 bg-green-700/55 rounded-xl p-3 whitespace-pre-line">
            {success}
          </div>
        ) : null}

        <button
          disabled={!canSubmit || loading}
          className="h-14 rounded-2xl bg-black/90 text-white text-lg shadow disabled:opacity-50"
        >
          {loading ? "...جاري" : "تسجيل"}
        </button>
      </form>
    </div>
  );
}