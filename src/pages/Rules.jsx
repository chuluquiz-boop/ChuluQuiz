import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import bg from "../assets/register-bg.png";
import PartnersHeader from "../components/PartnersHeader.jsx";
import { supabase } from "../lib/supabase";
import { apiFetch } from "../lib/api";

function Wrapper({ children, onLogout }) {
  return (
    <div
      className="min-h-screen w-full bg-center bg-cover relative flex flex-col"
      style={{ backgroundImage: `url(${bg})` }}
      dir="rtl"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/10" />

      <button
        onClick={onLogout}
        className="
          absolute top-4 right-4 z-50
          rounded-2xl px-4 py-2
          text-sm sm:text-base font-semibold
          text-slate-900
          bg-white/15 backdrop-blur-xl
          border border-white/25
          shadow-[0_10px_30px_rgba(0,0,0,0.18)]
          hover:bg-white/25 hover:border-white/35
          active:scale-[0.98]
          transition
        "
        type="button"
      >
        تسجيل الخروج
      </button>

      <div className="w-full flex justify-center pt-5 sm:pt-6 px-3 relative z-10">
        <PartnersHeader />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        {children}
      </div>
    </div>
  );
}

export default function Rules() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");

  const quizId = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return sp.get("quiz_id") || "";
  }, [location.search]);

  const selectedRule = useMemo(() => {
    return rules.find((r) => r.id === selectedId) || null;
  }, [rules, selectedId]);

  const onLogout = useCallback(async () => {
    const ok = window.confirm("هل تريد تسجيل الخروج؟");
    if (!ok) return;

    const sessionToken = localStorage.getItem("session_token");
    try {
      if (sessionToken) {
        await apiFetch("/api/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_token: sessionToken }),
        });
      }
    } catch {}

    localStorage.removeItem("session_token");
    localStorage.removeItem("quiz_token");
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");

    navigate("/login", { replace: true });
  }, [navigate]);

  // لازم session_token
  useEffect(() => {
    const sessionToken = localStorage.getItem("session_token");
    if (!sessionToken) navigate("/login");
  }, [navigate]);

  useEffect(() => {
    let mounted = true;

    async function loadAllRules() {
      setLoading(true);
      setError("");

      try {
        // 1) إذا كان quizId: جيب قواعد هذا الكويز
        if (quizId) {
          const { data, error: e1 } = await supabase
            .from("rules")
            .select("id, quiz_id, title, content, updated_at")
            .eq("quiz_id", quizId)
            .order("updated_at", { ascending: false });

          if (!e1 && Array.isArray(data) && data.length) {
            if (!mounted) return;
            setRules(data);
            setSelectedId(data[0].id);
            return;
          }
        }

        // 2) وإلا جيب القواعد العامة
        const { data, error: e2 } = await supabase
          .from("rules")
          .select("id, quiz_id, title, content, updated_at")
          .is("quiz_id", null)
          .order("updated_at", { ascending: false });

        if (e2) throw e2;

        if (!mounted) return;
        setRules(Array.isArray(data) ? data : []);
        setSelectedId(Array.isArray(data) && data[0] ? data[0].id : "");
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "تعذر تحميل القواعد");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAllRules();
    return () => {
      mounted = false;
    };
  }, [quizId]);

  return (
    <Wrapper onLogout={onLogout}>
      <div className="w-full max-w-3xl rounded-2xl bg-white/90 p-6 shadow">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-extrabold text-slate-900">قواعد المسابقة</h1>

          <button
            onClick={() => navigate(-1)}
            className="h-10 px-3 rounded-xl border bg-white hover:bg-slate-50 text-sm font-semibold"
            type="button"
          >
            رجوع
          </button>
        </div>

        {loading ? (
          <div className="rounded-xl bg-white p-4 border text-slate-700">جاري التحميل...</div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-red-700">
            {error}
          </div>
        ) : rules.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-4 border text-slate-700 leading-relaxed">
            لا توجد قواعد محفوظة بعد.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* List */}
            <div className="md:col-span-1">
              <div className="text-sm font-bold mb-2">
                كل القواعد ({rules.length})
              </div>

              <div className="max-h-[360px] overflow-auto grid gap-2">
                {rules.map((r) => {
                  const active = r.id === selectedId;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={[
                        "w-full text-right rounded-xl border px-3 py-2 transition",
                        active
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white hover:bg-slate-50",
                      ].join(" ")}
                      type="button"
                    >
                      <div className="font-semibold truncate">
                        {r.title ? r.title : "(بدون عنوان)"}
                      </div>
                      <div className={`text-xs mt-1 ${active ? "text-white/80" : "text-slate-500"}`}>
                        {r.updated_at ? new Date(r.updated_at).toLocaleString() : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <div className="md:col-span-2">
              <div className="text-sm text-slate-600 mb-2">
                آخر تحديث:{" "}
                {selectedRule?.updated_at
                  ? new Date(selectedRule.updated_at).toLocaleString()
                  : "—"}
              </div>

              {selectedRule?.title ? (
                <div className="text-lg font-extrabold text-slate-900 mb-3">
                  {selectedRule.title}
                </div>
              ) : null}

              <div className="rounded-xl bg-slate-50 p-4 border text-slate-800 leading-relaxed whitespace-pre-wrap">
                {selectedRule?.content || "—"}
              </div>
            </div>
          </div>
        )}
      </div>
    </Wrapper>
  );
}