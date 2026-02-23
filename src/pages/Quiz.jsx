import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import bg from "../assets/register-bg.png";
import { apiFetch } from "../lib/api";
import Leaderboard from "./Leaderboard";
import PartnersHeader from "../components/PartnersHeader.jsx";
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

// ✅ عداد كبير قبل البداية
function PreCountdown({ seconds }) {
  return (
    <div className="w-full max-w-lg rounded-2xl bg-white/90 p-8 shadow text-center">
      <div className="text-slate-600 mb-3 text-lg">استعد! يبدأ الكويز بعد</div>
      <div className="text-7xl font-extrabold tabular-nums">{seconds}</div>
      <div className="mt-4 text-slate-500 text-sm">
        سيتم عرض السؤال الأول مباشرة بعد انتهاء العدّاد
      </div>
    </div>
  );
}

// ✅ (مهم) لازم Wrapper يكون خارج Quiz() باش مايصراش remount كل render
function Wrapper({ children, onLogout }) {
  return (
    <div
      className="min-h-screen w-full bg-center bg-cover flex flex-col"
      style={{ backgroundImage: `url(${bg})` }}
      dir="rtl"
    >
      {/* ===== Header ثابت ومتجاوب ===== */}
      <div className="w-full flex items-center justify-between px-4 sm:px-8 pt-6">

        {/* زر الخروج */}
        <button
          onClick={onLogout}
          className="
            rounded-xl
            border-2
            border-white/80
            bg-white/30
            px-4
            py-2
            text-sm
            sm:text-base
            font-semibold
            text-gray-900
            backdrop-blur-sm
            shadow
            hover:bg-white/40
            transition
          "
          type="button"
        >
          تسجيل الخروج
        </button>

        {/* Partners Header */}
        <div className="flex-1 flex justify-center">
          <PartnersHeader />
        </div>

        {/* spacer يمين لموازنة الزر */}
        <div className="w-[100px] hidden sm:block"></div>
      </div>

      {/* ===== محتوى الصفحة ===== */}
      <div className="flex-1 flex items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
}

export default function Quiz() {
  const [username, setUsername] = useState("");
  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
  }, []);
  const navigate = useNavigate();

  const [showBoard, setShowBoard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ctrl, setCtrl] = useState(null);
  const [now, setNow] = useState(Date.now());

  const [questions, setQuestions] = useState([]);
  const [qLoading, setQLoading] = useState(false);

  // إعدادات التوقيت من Supabase
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(3);

  // فرق توقيت الجهاز عن السيرفر
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  // حالة العرض المتزامن
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(3);
  const finishedSentRef = useRef(false);
  // تخزين اختيارات المستخدم لكل سؤال
  const [pickedByQuestion, setPickedByQuestion] = useState({});
  const [resultByQuestion, setResultByQuestion] = useState({});

  // (اختياري) عرض مجموع النقاط من السيرفر مباشرة
  const [serverScore, setServerScore] = useState(null);

  // لمنع اختيار أكثر من مرة لنفس السؤال
  const lockedQuestionsRef = useRef(new Set());

  // ✅ تسجيل الخروج
  const onLogout = useCallback(async () => {
    const ok = window.confirm("هل تريد تسجيل الخروج؟");
    if (!ok) return;

    const sessionToken = localStorage.getItem("session_token");

    // 1) احذف session من قاعدة البيانات عبر backend
    try {
      if (sessionToken) {
        await apiFetch("/api/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_token: sessionToken }),
        });
      }
    } catch (e) {
      console.warn("logout api failed:", e);
    }

    // 2) امسح localStorage
    localStorage.removeItem("session_token");
    localStorage.removeItem("quiz_token");
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");

    setShowBoard(false);
    navigate("/login", { replace: true });
  }, [navigate]);

  // ✅ تحقق من وجود session_token
  useEffect(() => {
    const sessionToken = localStorage.getItem("session_token");
    if (!sessionToken) navigate("/login");
  }, [navigate]);

  // تحديث الوقت للـ countdown العام (scheduled)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // جلب quiz_control أول مرة
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

      if (error || !data) {
        setCtrl({ status: "none", starts_at: null, active_quiz_id: null });
      } else {
        setCtrl(data);
      }
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Realtime: أي تغيير من الأدمن (فقط quiz_control)
  useEffect(() => {
    const channel = supabase
      .channel("quiz_control_changes")
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

  // تحديد وضع العرض
  const view = useMemo(() => {
    if (!ctrl) return { mode: "none" };

    const status = ctrl.status;
    const startsAtMs = ctrl.starts_at ? new Date(ctrl.starts_at).getTime() : null;

    if (!ctrl.active_quiz_id) return { mode: "none", reason: "no_active_quiz" };

    if (status === "live") {
      return { mode: "live", quizId: ctrl.active_quiz_id, startsAtMs };
    }

    if (status === "scheduled" && startsAtMs) {
      const diff = startsAtMs - now;
      if (diff <= 0) return { mode: "live", quizId: ctrl.active_quiz_id, startsAtMs };
      return { mode: "scheduled", diffMs: diff, startsAtMs, quizId: ctrl.active_quiz_id };
    }

    return { mode: "none" };
  }, [ctrl, now]);

  // ✅ مزامنة وقت السيرفر (مرة + كل 15 ثانية)
  useEffect(() => {
    let mounted = true;

    async function syncServerTime() {
      const t0 = Date.now();
      const { data, error } = await supabase.rpc("server_time");
      const t1 = Date.now();

      if (!mounted) return;
      if (error || !data) return;

      const serverMs = new Date(data).getTime();
      const rtt = t1 - t0;
      const estimatedClientAtReply = t0 + rtt / 2;
      const offset = serverMs - estimatedClientAtReply;

      setServerOffsetMs(offset);
    }

    syncServerTime();
    const interval = setInterval(syncServerTime, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    if (view.mode !== "live") return;
    if (!questions.length) return;

    const total = questions.length;

    // انتهى الكويز؟
    if (currentIdx < total) return;

    if (finishedSentRef.current) return;
    finishedSentRef.current = true;

    // نعلم السيرفر (backend) أفضل من anon مباشرة
    const quizId = view.quizId;

    fetch("/api/admin/quiz-control/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quiz_id: quizId }),
    }).catch(() => {
      // حتى لو فشل، ما نحبسوش UI
    });
  }, [view.mode, view.quizId, questions.length, currentIdx]);
  // ✅ (جديد) استرجاع إجابات اللاعب من Supabase بعد تحميل الأسئلة
  const restoreProgressFromDb = useCallback(async (quizId) => {
    try {
      const userIdRaw = localStorage.getItem("user_id");
      const userId = Number(userIdRaw);

      if (!quizId) return;
      if (!userIdRaw || Number.isNaN(userId)) return;

      // 1) answers
      const { data: answers, error: aErr } = await supabase
        .from("quiz_answers")
        .select("question_id, choice_id, is_correct, answered_at")
        .eq("quiz_id", quizId)
        .eq("user_id", userId)
        .order("answered_at", { ascending: true });

      if (aErr) {
        console.warn("restore answers error:", aErr);
        return;
      }

      const pickedMap = {};
      const resultMap = {};
      const lockedSet = new Set();

      for (const a of answers || []) {
        if (!a?.question_id) continue;
        pickedMap[a.question_id] = a.choice_id ?? null;
        resultMap[a.question_id] = a.is_correct ? "correct" : "wrong";
        lockedSet.add(a.question_id);
      }

      setPickedByQuestion(pickedMap);
      setResultByQuestion(resultMap);
      lockedQuestionsRef.current = lockedSet;

      // 2) score (اختياري)
      const { data: scoreRow, error: sErr } = await supabase
        .from("quiz_scores")
        .select("score")
        .eq("quiz_id", quizId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!sErr && scoreRow?.score != null) {
        setServerScore(scoreRow.score);
      }
    } catch (e) {
      console.warn("restoreProgressFromDb failed:", e);
    }
  }, []);

  // 2) عند الدخول Live: اجلب الأسئلة + إعدادات المؤقت + ✅ استرجاع التقدم
  useEffect(() => {
    let mounted = true;

    async function loadQuestionsAndSettings(quizId) {
      setQLoading(true);

      // reset local state (ثم نرجّع من DB بعد قليل)
      setQuestions([]);
      setPickedByQuestion({});
      setResultByQuestion({});
      lockedQuestionsRef.current = new Set();
      setCurrentIdx(0);
      setServerScore(null);
      setShowBoard(false);

      // settings
      const { data: settings } = await supabase
        .from("quiz_settings")
        .select("seconds_per_question")
        .eq("quiz_id", quizId)
        .maybeSingle();

      const seconds = Math.max(1, Number(settings?.seconds_per_question ?? 3));
      if (!mounted) return;
      setSecondsPerQuestion(seconds);
      setTimeLeft(seconds);

      // questions
      const { data, error } = await supabase
        .from("questions")
        .select(
          `
          id,
          question_text,
          created_at,
          level:levels ( id, name, points, order_index ),
          choices:choices_public ( id, label, choice_text )
        `
        )
        .eq("quiz_id", quizId);

      if (!mounted) return;

      if (error || !data) {
        setQuestions([]);
        setQLoading(false);
        return;
      }

      const sorted = [...data].sort((a, b) => {
        const ao = a.level?.order_index ?? 9999;
        const bo = b.level?.order_index ?? 9999;
        if (ao !== bo) return ao - bo;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      for (const q of sorted) {
        q.choices = (q.choices || []).sort((c1, c2) =>
          String(c1.label).localeCompare(String(c2.label))
        );
      }

      setQuestions(sorted);

      // ✅ استرجاع الإجابات/القفل/النتيجة بعد ما الأسئلة جاهزة
      // (مهم باش refresh يخلّي الاختيار ظاهر ومغلق)
      await restoreProgressFromDb(quizId);

      setQLoading(false);
    }

    if (view.mode === "live" && view.quizId) {
      loadQuestionsAndSettings(view.quizId);
    }

    return () => {
      mounted = false;
    };
  }, [view.mode, view.quizId, restoreProgressFromDb]);

  // ✅ حساب pre-countdown (10 ثواني قبل starts_at)
  const serverNowMs = Date.now() + serverOffsetMs;
  const preCountdown = useMemo(() => {
    if (!view?.startsAtMs) return { show: false, seconds: 0 };

    const diffMs = view.startsAtMs - serverNowMs;
    if (diffMs <= 0) return { show: false, seconds: 0 };

    if (diffMs <= 10_000) {
      return { show: true, seconds: Math.ceil(diffMs / 1000) };
    }
    return { show: false, seconds: 0 };
  }, [view?.startsAtMs, serverNowMs]);

  // 3) التزامن: حساب السؤال الحالي والوقت المتبقي
  useEffect(() => {
    if (view.mode !== "live") return;
    if (!questions.length) return;

    const startsAtMs = view.startsAtMs;
    if (!startsAtMs) return;

    let intervalId = null;

    const tick = () => {
      const total = questions.length;

      const serverNow = Date.now() + serverOffsetMs;
      const elapsedMs = serverNow - startsAtMs;

      if (elapsedMs < 0) {
        setCurrentIdx(0);
        setTimeLeft(secondsPerQuestion);
        return;
      }

      const elapsedSec = Math.floor(elapsedMs / 1000);
      const idx = Math.floor(elapsedSec / secondsPerQuestion);

      // ✅ كي يكمل الكويز حبّس التحديثات نهائياً
      if (idx >= total) {
        setCurrentIdx(total);
        setTimeLeft(0);
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
        return;
      }

      const inQuestionSec = elapsedSec % secondsPerQuestion;
      const remaining = Math.max(0, secondsPerQuestion - inQuestionSec);

      setCurrentIdx(idx);
      setTimeLeft(remaining);
    };

    tick();
    intervalId = setInterval(tick, 200);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [view.mode, view.startsAtMs, questions.length, secondsPerQuestion, serverOffsetMs]);

  // نقاط محلية (fallback)
  const localScore = useMemo(() => {
    if (!questions.length) return 0;
    let s = 0;
    for (const q of questions) {
      if (resultByQuestion[q.id] === "correct") s += q.level?.points ?? 0;
    }
    return s;
  }, [questions, resultByQuestion]);

  const scoreToShow = serverScore ?? localScore;

  const canPick = useCallback((questionId) => !lockedQuestionsRef.current.has(questionId), []);

  // ✅ submit_answer_token
  async function pickChoice(question, choice) {
    const token = localStorage.getItem("session_token");
    if (!token) {
      navigate("/login");
      return;
    }

    if (!canPick(question.id)) return;

    lockedQuestionsRef.current.add(question.id);

    // ✅ مهم: خلي الاختيار يظهر مباشرة
    setPickedByQuestion((prev) => ({ ...prev, [question.id]: choice.id }));

    const { data, error } = await supabase.rpc("submit_answer_token", {
      p_token: token,
      p_quiz_id: view.quizId,
      p_question_id: question.id,
      p_choice_id: choice.id,
    });

    if (error) {
      console.error("submit_answer_token error:", error);
      alert(error.message || "تعذر حفظ الإجابة");

      // ✅ (تحسين) لو فشل الحفظ، رجّع القفل والاختيار محلياً
      lockedQuestionsRef.current.delete(question.id);
      setPickedByQuestion((prev) => {
        const copy = { ...prev };
        delete copy[question.id];
        return copy;
      });
      return;
    }

    const row = data?.[0];
    setResultByQuestion((prev) => ({
      ...prev,
      [question.id]: row?.is_correct ? "correct" : "wrong",
    }));

    if (row?.total_score != null) setServerScore(row.total_score);
  }

  // ===== UI حالات عامة =====
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <div className="rounded-2xl bg-white p-4 shadow">جاري التحميل...</div>
      </div>
    );
  }

  if (view.mode === "none") {
    return (
      <Wrapper onLogout={onLogout}>
        <div className="w-full max-w-lg rounded-2xl bg-white/90 p-6 shadow text-center">
          <h1 className="text-2xl font-bold mb-2">
            مرحبا، <span className="text-slate-900">{username}</span> 👋
          </h1>
          <h1 className="text-2xl font-bold mb-2">لا يوجد كويز قادم الآن</h1>
          <p className="text-slate-600">عند إضافة كويز مستقبلا سيظهر هنا.</p>
        </div>
      </Wrapper>
    );
  }

  if (view.mode === "scheduled" && preCountdown.show) {
    return (
      <Wrapper onLogout={onLogout}>
        <PreCountdown seconds={preCountdown.seconds} />
      </Wrapper>
    );
  }

  if (view.mode === "scheduled") {
    const { h, m, s } = msToParts(view.diffMs);
    return (
      <Wrapper onLogout={onLogout}>
        <div className="w-full max-w-lg rounded-2xl bg-white/90 p-6 shadow text-center">
          <h1 className="text-2xl font-bold mb-2">الكويز مجدول</h1>
          <p className="text-slate-600 mb-5">سيبدأ تلقائيًا عند الوصول للوقت المحدد.</p>

          <div className="flex items-center justify-center gap-3 text-3xl font-bold">
            <span className="rounded-xl bg-slate-100 px-4 py-3">{pad2(h)}</span>
            <span>:</span>
            <span className="rounded-xl bg-slate-100 px-4 py-3">{pad2(m)}</span>
            <span>:</span>
            <span className="rounded-xl bg-slate-100 px-4 py-3">{pad2(s)}</span>
          </div>

          <div className="mt-4 text-sm text-slate-500">
            يبدأ عند: {new Date(view.startsAtMs).toLocaleString()}
          </div>
        </div>
      </Wrapper>
    );
  }

  if (qLoading) {
    return (
      <Wrapper onLogout={onLogout}>
        <div className="w-full max-w-lg rounded-2xl bg-white/90 p-6 shadow text-center">
          جاري تحميل أسئلة الكويز...
        </div>
      </Wrapper>
    );
  }

  if (!questions.length) {
    return (
      <Wrapper onLogout={onLogout}>
        <div className="w-full max-w-lg rounded-2xl bg-white/90 p-6 shadow text-center">
          <h1 className="text-2xl font-bold mb-2">الكويز شغال ✅</h1>
          <p className="text-slate-600">لكن لا توجد أسئلة مرتبطة بهذا الكويز.</p>
          <p className="text-slate-500 text-sm mt-3">
            ملاحظة: لضمان التزامن لازم quiz_control.starts_at يكون مضبوط.
          </p>
        </div>
      </Wrapper>
    );
  }

  if (view.mode === "live" && preCountdown.show) {
    return (
      <Wrapper onLogout={onLogout}>
        <PreCountdown seconds={preCountdown.seconds} />
      </Wrapper>
    );
  }

  const total = questions.length;
  const finished = currentIdx >= total;

  if (finished) {
    return (
      <Wrapper onLogout={onLogout}>
        {showBoard ? (
          <Leaderboard quizId={view.quizId} onClose={() => setShowBoard(false)} />
        ) : null}

        <div className="w-full max-w-lg rounded-2xl bg-white/90 p-6 shadow text-center">
          <h1 className="text-3xl font-bold mb-2">انتهى الكويز 🎉</h1>
          <p className="text-slate-700 text-lg">
            مجموع نقاطك: <span className="font-bold">{scoreToShow}</span>
          </p>

          <button
            onClick={() => setShowBoard(true)}
            className="mt-4 w-full h-12 rounded-2xl bg-black/90 text-white shadow"
            type="button"
          >
            عرض الترتيب النهائي 🏆
          </button>
        </div>
      </Wrapper>
    );
  }

  const q = questions[currentIdx];
  const picked = pickedByQuestion[q.id] ?? null;
  const result = resultByQuestion[q.id] ?? null;
  const locked = lockedQuestionsRef.current.has(q.id);

  return (
    <Wrapper onLogout={onLogout}>
      <div className="w-full max-w-lg rounded-2xl bg-white/90 p-6 shadow">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-slate-700">
            سؤال {Math.min(currentIdx + 1, total)} / {total}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm font-bold">⏱️ {timeLeft}s</div>
            <div className="text-sm font-semibold text-slate-800">
              النقاط: {scoreToShow}
            </div>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <span className="inline-flex items-center rounded-xl bg-slate-100 px-3 py-1 text-sm font-semibold">
            {q.level?.name ?? "مستوى"}
          </span>
          <span className="text-sm text-slate-600">قيمة السؤال: {q.level?.points ?? 0}</span>
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-4 text-center">
          {q.question_text}
        </h2>

        <div className="grid gap-3">
          {q.choices.map((c) => {
            const isPicked = picked === c.id;

            let extra = "";
            if (locked) {
              if (isPicked && result === "correct") extra = "border-green-600 bg-green-50";
              else if (isPicked && result === "wrong") extra = "border-red-600 bg-red-50";
              else extra = "opacity-80";
            } else {
              // ✅ (تحسين بسيط) إبراز الاختيار حتى قبل الإرسال لو تحب
              if (isPicked) extra = "border-slate-900 bg-slate-50";
            }

            return (
              <button
                key={c.id}
                onClick={() => pickChoice(q, c)}
                className={`h-14 rounded-2xl border bg-white px-4 text-right shadow-sm transition ${extra}`}
                disabled={locked}
                type="button"
              >
                <span className="font-bold ml-2">{c.label}.</span>
                {c.choice_text}
              </button>
            );
          })}
        </div>

        <div className="mt-5 text-center text-sm text-slate-600">
          الانتقال بين الأسئلة يتم تلقائيًا حسب وقت الكويز ✅
        </div>
      </div>
    </Wrapper>
  );
}