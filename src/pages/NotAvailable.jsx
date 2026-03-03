import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import bg from "../assets/register-bg.png";
import PartnersHeader from "../components/PartnersHeader.jsx";
import SiteFooter from "../components/SiteFooter.jsx";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function msToParts(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h, m, s };
}

// ✅ server_time() قد يرجع string أو object أو array
function parseServerTime(data) {
  if (!data) return null;

  if (typeof data === "string") return new Date(data);

  if (Array.isArray(data)) {
    const first = data[0];
    if (!first) return null;
    if (typeof first === "string") return new Date(first);

    const val = first?.server_time || first?.now || first?.time || Object.values(first || {})[0];
    return val ? new Date(val) : null;
  }

  if (typeof data === "object") {
    const val = data.server_time || data.now || data.time || Object.values(data)[0];
    return val ? new Date(val) : null;
  }

  return null;
}

// ✅ parse قوي لـ starts_at
function parseTsToMs(ts) {
  if (!ts) return null;

  if (ts instanceof Date) {
    const ms = ts.getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  const s = String(ts);

  let ms = Date.parse(s);
  if (Number.isFinite(ms)) return ms;

  if (s.includes(" ") && !s.includes("T")) {
    ms = Date.parse(s.replace(" ", "T") + "Z");
    if (Number.isFinite(ms)) return ms;
  }

  return null;
}

function Wrapper({ children }) {
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

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">{children}</div>
    </div>
  );
}

function OriginalNotAvailable() {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6" dir="rtl">
      <div className="max-w-md w-full rounded-2xl bg-white p-6 shadow">
        <h1 className="text-xl font-bold">غير متاح الآن</h1>
        <p className="mt-2 text-slate-600">التطبيق موقف مؤقتا . تابعونا على فيسبوك لأي جديد</p>
      </div>
    </div>
  );
}

export default function NotAvailable() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [ctrl, setCtrl] = useState(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  // ===== Scheduled Copy (نصوص المجدول) =====
  const [scheduledTitle, setScheduledTitle] = useState("");
  const [scheduledStartLine, setScheduledStartLine] = useState("");
  const [scheduledBody, setScheduledBody] = useState([]);
  const [scheduledCopyLoading, setScheduledCopyLoading] = useState(false);
  // ✅ تحميل quiz_control
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const { data, error } = await supabase
        .from("quiz_control")
        .select("id,status,starts_at,active_quiz_id,updated_at")
        .eq("id", 1)
        .maybeSingle();

      if (!mounted) return;

      if (error || !data) setCtrl({ status: "none", starts_at: null, active_quiz_id: null });
      else setCtrl(data);

      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // ✅ realtime quiz_control
  useEffect(() => {
    const channel = supabase
      .channel("quiz_control_changes_notavailable")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quiz_control", filter: "id=eq.1" },
        (payload) => {
          const row = payload.new || payload.old;
          if (row) setCtrl(row);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ✅ sync server time (باش العدّاد يكون صحيح)
  useEffect(() => {
    let mounted = true;

    async function syncServerTime() {
      const t0 = Date.now();
      const { data, error } = await supabase.rpc("server_time");
      const t1 = Date.now();

      if (!mounted) return;
      if (error || !data) return;

      const dt = parseServerTime(data);
      if (!dt || !Number.isFinite(dt.getTime())) return;

      const serverMs = dt.getTime();
      const rtt = t1 - t0;
      const estimatedClientAtReply = t0 + rtt / 2;
      const offset = serverMs - estimatedClientAtReply;

      if (Number.isFinite(offset)) setServerOffsetMs(offset);
    }

    syncServerTime();
    const interval = setInterval(syncServerTime, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // ✅ نحدّث UI كل ثانية (باش العدّاد ينقص)
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const safeOffset = Number.isFinite(serverOffsetMs) ? serverOffsetMs : 0;
  const serverNowMs = Date.now() + safeOffset;

  const view = useMemo(() => {
    if (!ctrl) return { mode: "none" };
    const status = ctrl.status;
    const startsAtMs = parseTsToMs(ctrl.starts_at);

    if (!ctrl.active_quiz_id) return { mode: "none" };

    if (status === "scheduled" && startsAtMs) {
      const diff = startsAtMs - serverNowMs;
      if (diff <= 0) return { mode: "live", quizId: ctrl.active_quiz_id, startsAtMs };
      return { mode: "scheduled", diffMs: diff, startsAtMs, quizId: ctrl.active_quiz_id };
    }

    return { mode: "none" };
  }, [ctrl, serverNowMs]);
  // ✅ تحميل نصوص scheduled من DB (title + start_line + body)
  useEffect(() => {
    let mounted = true;

    async function loadScheduledCopy() {
      if (view.mode !== "scheduled") return;

      setScheduledCopyLoading(true);

      async function fetchByQuiz(quizIdNullable) {
        let q = supabase
          .from("scheduled_copy")
          .select("slot, content, order_index")
          .eq("stat", 1)
          .eq("state", 1)
          .order("order_index", { ascending: true });

        if (quizIdNullable === null) q = q.is("quiz_id", null);
        else q = q.eq("quiz_id", quizIdNullable);

        const { data, error } = await q;
        if (error) throw error;
        return Array.isArray(data) ? data : [];
      }

      try {
        // 1) نحاول نجيب النصوص الخاصة بالكويز
        let rows = [];
        if (view.quizId) rows = await fetchByQuiz(view.quizId);

        // 2) إذا ماكانش، نجيب العامة
        if (!rows.length) rows = await fetchByQuiz(null);

        if (!mounted) return;

        const titleRow = rows.find((r) => r.slot === "title");
        const startRow = rows.find((r) => r.slot === "start_line");

        setScheduledTitle(titleRow?.content ? String(titleRow.content) : "الكويز مجدول");
        setScheduledStartLine(
          startRow?.content ? String(startRow.content) : "سيبدأ تلقائيًا عند الوصول للوقت المحدد"
        );

        const bodyRows = rows
          .filter((r) => r.slot === "body")
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

        setScheduledBody(bodyRows);
      } catch (e) {
        console.warn("NotAvailable scheduled copy failed:", e);
        if (!mounted) return;

        setScheduledTitle("الكويز مجدول");
        setScheduledStartLine("سيبدأ تلقائيًا عند الوصول للوقت المحدد");
        setScheduledBody([]);
      } finally {
        if (mounted) setScheduledCopyLoading(false);
      }
    }

    loadScheduledCopy();

    return () => {
      mounted = false;
    };
  }, [view.mode, view.quizId]);

  // ✅ إذا مازال يحمل
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <div className="rounded-2xl bg-white p-4 shadow">جاري التحميل...</div>
      </div>
    );
  }

  // ✅ إذا Scheduled نعرض نفس شاشة scheduled
  if (view.mode === "scheduled") {
    const { h, m, s } = msToParts(view.diffMs);

    return (
      <Wrapper>
        <div className="w-full max-w-lg rounded-2xl bg-white/90 p-6 shadow text-center -mt-14">
          <h1 className="text-2xl font-bold mb-2">
            {scheduledCopyLoading ? "..." : (scheduledTitle || "الكويز مجدول")}
          </h1>

          <p className="mb-5 text-red-600 font-extrabold text-xl">
            {scheduledCopyLoading ? "..." : (scheduledStartLine || "سيبدأ تلقائيًا عند الوصول للوقت المحدد")}
          </p>

          {scheduledCopyLoading ? (
            <p className="text-slate-500 mb-5">جاري تحميل تفاصيل الكويز...</p>
          ) : scheduledBody.length ? (
            <div className="text-slate-600 mb-5 space-y-2 text-right">
              {scheduledBody.map((row, idx) => (
                <p key={idx}>{row.content}</p>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 mb-5">انتظرونا… سيتم نشر التفاصيل قريبًا.</p>
          )}

          <button
            onClick={() => navigate(`/rules?quiz_id=${view.quizId}`)}
            className="mt-4 w-full h-12 rounded-2xl bg-white border border-slate-200 text-slate-900 font-semibold shadow-sm hover:bg-slate-50 transition"
            type="button"
          >
            📜 قواعد المسابقة
          </button>

          <div dir="ltr" className="mt-5 flex items-end justify-center gap-3 font-bold">
            <div className="flex flex-col items-center">
              <div className="rounded-xl bg-slate-100 px-4 py-3 text-3xl tabular-nums">{pad2(h)}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">h</div>
            </div>

            <div className="pb-6 text-3xl text-slate-400">:</div>

            <div className="flex flex-col items-center">
              <div className="rounded-xl bg-slate-100 px-4 py-3 text-3xl tabular-nums">{pad2(m)}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">m</div>
            </div>

            <div className="pb-6 text-3xl text-slate-400">:</div>

            <div className="flex flex-col items-center">
              <div className="rounded-xl bg-slate-100 px-4 py-3 text-3xl tabular-nums">{pad2(s)}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">s</div>
            </div>
          </div>

          <div className="mt-4 text-sm text-slate-500">
            يبدأ عند: {view.startsAtMs ? new Date(view.startsAtMs).toLocaleString() : "—"}
          </div>

          <a
            href="https://web.facebook.com/people/ChuluQuiz/61575643237719/"
            target="_blank"
            rel="noreferrer"
            className="mt-6 block w-full text-center text-black/80 text-xs md:text-sm tracking-[0.3em] font-semibold hover:text-green transition"
          >
            صفحتنا على الفيسبوك لمزيد من التفاصيل
          </a>
          <SiteFooter />
        </div>

      </Wrapper>

    );
  }

  // ✅ إذا ليس scheduled نعرض NotAvailable الأصلية
  return <OriginalNotAvailable />;
}
