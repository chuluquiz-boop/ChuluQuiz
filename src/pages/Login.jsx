import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import bg from "../assets/register-bg.png";
import { apiFetch } from "../lib/api";
import PartnersHeader from "../components/PartnersHeader.jsx";
import { supabase } from "../lib/supabase.js";

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // لازم لقب فقط
  const canSubmit = username.trim().length >= 2;

  // ✅ نجيب quiz_id الحقيقي من quiz_control (active_quiz_id)
  async function getActiveQuizId() {
    const { data, error: sErr } = await supabase
      .from("quiz_control")
      .select("active_quiz_id,status")
      .eq("id", 1)
      .maybeSingle();

    if (sErr) throw new Error(sErr.message);

    const qid = String(data?.active_quiz_id || "").trim();
    if (!qid) throw new Error("لا يوجد كويز نشط حاليا (active_quiz_id فارغ).");

    return qid;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("اكتب لقب لا يقل عن حرفين.");
      return;
    }

    setLoading(true);
    try {
      // ✅ 1) نجيب quiz_id من Supabase بدل الرابط
      const quizId = await getActiveQuizId();

      // ✅ 2) Join quiz session (temporary)
      const json = await apiFetch("/api/quiz/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quiz_id: quizId, // ✅ لازم يكون موجود
          username: username.trim(),
        }),
      });

      if (!json?.session_token) throw new Error("session_token غير موجود من السيرفر");

      // ✅ نخزنو session لكل كويز + fallback keys
      const keyPrefix = `quiz_${quizId}_`;

      localStorage.setItem(`${keyPrefix}session_token`, json.session_token);
      if (json.user_id != null) localStorage.setItem(`${keyPrefix}user_id`, String(json.user_id));
      if (json.username) localStorage.setItem(`${keyPrefix}username`, String(json.username));

      // ✅ fallback keys (باش ما نكسروش RequireAuth/Quiz الحالي)
      localStorage.setItem("session_token", json.session_token);
      if (json.user_id != null) localStorage.setItem("user_id", String(json.user_id));
      if (json.username) localStorage.setItem("username", String(json.username));

      // (اختياري) إذا تحب تخزّن آخر quiz_id
      localStorage.setItem("last_quiz_id", quizId);

      navigate("/quiz");
    } catch (err) {
      setError(err?.message || "تعذر إنشاء جلسة الدخول.");
    } finally {
      setLoading(false);
    }
  }

  // ✅ تنظيف بسيط عند فتح صفحة الدخول (اختياري)
  useEffect(() => {
    setError("");
  }, []);

  return (
    <div
      className="min-h-screen w-full bg-center bg-cover relative flex flex-col"
      style={{ backgroundImage: `url(${bg})` }}
      dir="rtl"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/10" />

      <div className="w-full flex justify-center pt-5 sm:pt-6 px-3 relative z-10">
        <PartnersHeader />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <form onSubmit={onSubmit} className="w-full max-w-md">
          <div className="rounded-[26px] p-[1px] bg-gradient-to-r from-white/35 via-white/10 to-white/35 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
            <div className="rounded-[25px] bg-white/12 backdrop-blur-2xl border border-white/15 p-6 sm:p-7">
              <div className="flex flex-col gap-4">
                <h1 className="text-center text-white font-extrabold text-xl sm:text-2xl drop-shadow">
                  دخول سريع 🎟️
                </h1>

                <p className="text-center text-white/80 text-sm">تسجيل الدخول</p>

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
                  placeholder="اكتب اسمك للمشاركة"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="nickname"
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

                <div className="text-center text-xs text-white/60">
                  ملاحظة: يتم جلب الكويز النشط تلقائياً ✅
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
