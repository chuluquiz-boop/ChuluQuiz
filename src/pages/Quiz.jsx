import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import bg from "../assets/register-bg.png";
import NoQuizPanel from "../components/NoQuizPanel.jsx";
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

function pointsFromLevel(level) {
  // نعرض 1/2/3 بدل 10/20/30
  const id = Number(level?.id);
  if (id === 1) return 1;
  if (id === 2) return 2;
  if (id === 3) return 3;
  return 1;
}

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

export default function Quiz() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
  }, []);

  // ✅ state تاع المستخدم
  const [userState, setUserState] = useState(null);
  const [stateLoading, setStateLoading] = useState(true);

  const [showBoard, setShowBoard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ctrl, setCtrl] = useState(null);
  const [now, setNow] = useState(Date.now());

  const [questions, setQuestions] = useState([]);
  const [qLoading, setQLoading] = useState(false);

  const [secondsPerQuestion, setSecondsPerQuestion] = useState(3);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  // currentIdx = المؤشر الحقيقي حسب وقت السيرفر
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(3);

  // displayedIdx = المؤشر اللي نعرضه فعلياً (نستعمله باش نثبت سؤال قبل الانتقال خلال reveal)
  const [displayedIdx, setDisplayedIdx] = useState(0);

  const finishedSentRef = useRef(false);

  // ===== answers =====
  const [pickedByQuestion, setPickedByQuestion] = useState({});
  const [resultByQuestion, setResultByQuestion] = useState({}); // correct/wrong/timeout
  const [pendingByQuestion, setPendingByQuestion] = useState({}); // نخزن نتيجة السيرفر هنا مؤقتاً (بدون تلوين)

  const [serverScore, setServerScore] = useState(null);

  // نمنع اختيار أكثر من مرة للسؤال
  const lockedQuestionsRef = useRef(new Set());

  // ===== Lifelines =====
  const [usedHint, setUsedHint] = useState(false);
  const [used5050, setUsed5050] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [hintText, setHintText] = useState("");
  const [hiddenChoicesByQuestion, setHiddenChoicesByQuestion] = useState({}); // { [qid]: string[] }

  // timeout penalty once per question
  const timeoutAppliedRef = useRef(new Set()); // qid set

  // reveal control
  const REVEAL_MS = 1200; // مدة ظهور النتيجة قبل الانتقال
  const revealTimerRef = useRef(null);

  // ===== Sounds =====
  const sfx = useRef({
    click: null,
    correct: null,
    wrong: null,
    penalty: null,
  });

  useEffect(() => {
    sfx.current.click = new Audio("/sfx/click.mp3");
    sfx.current.correct = new Audio("/sfx/correct-clap.mp3");
    sfx.current.wrong = new Audio("/sfx/wrong.mp3");
    sfx.current.penalty = new Audio("/sfx/penalty.mp3");
    for (const k of Object.keys(sfx.current)) {
      try {
        sfx.current[k].preload = "auto";
        sfx.current[k].volume = 0.8;
      } catch {}
    }
  }, []);

  const play = useCallback((name) => {
    try {
      const a = sfx.current[name];
      if (!a) return;
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch {}
  }, []);

  // ===== Logout =====
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
    } catch (e) {
      console.warn("logout api failed:", e);
    }

    localStorage.removeItem("session_token");
    localStorage.removeItem("quiz_token");
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");

    setShowBoard(false);
    navigate("/login", { replace: true });
  }, [navigate]);

  // سريع: لازم token
  useEffect(() => {
    const sessionToken = localStorage.getItem("session_token");
    if (!sessionToken) navigate("/login");
  }, [navigate]);

  // تحقق state + polling
  useEffect(() => {
    let alive = true;

    async function checkState() {
      const sessionToken = localStorage.getItem("session_token");
      if (!sessionToken) {
        if (!alive) return;
        setStateLoading(false);
        navigate("/login", { replace: true });
        return;
      }

      try {
        const res = await apiFetch("/api/me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_token: sessionToken }),
        });

        if (!alive) return;

        const st = Number(res?.user?.state);
        setUserState(Number.isFinite(st) ? st : null);

        if (res?.user?.username) setUsername(res.user.username);

        setStateLoading(false);
      } catch (e) {
        if (!alive) return;

        setStateLoading(false);
        localStorage.removeItem("session_token");
        localStorage.removeItem("quiz_token");
        localStorage.removeItem("token");
        localStorage.removeItem("user_id");
        localStorage.removeItem("username");
        navigate("/login", { replace: true });
      }
    }

    checkState();
    const t = setInterval(checkState, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [navigate]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // quiz_control load
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

  // quiz_control realtime
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

  const view = useMemo(() => {
    if (!ctrl) return { mode: "none" };
    const status = ctrl.status;
    const startsAtMs = ctrl.starts_at ? new Date(ctrl.starts_at).getTime() : null;

    if (!ctrl.active_quiz_id) return { mode: "none", reason: "no_active_quiz" };

    if (status === "live") return { mode: "live", quizId: ctrl.active_quiz_id, startsAtMs };

    if (status === "scheduled" && startsAtMs) {
      const diff = startsAtMs - now;
      if (diff <= 0) return { mode: "live", quizId: ctrl.active_quiz_id, startsAtMs };
      return { mode: "scheduled", diffMs: diff, startsAtMs, quizId: ctrl.active_quiz_id };
    }

    return { mode: "none" };
  }, [ctrl, now]);

  // sync server time
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
      setServerOffsetMs(serverMs - estimatedClientAtReply);
    }

    syncServerTime();
    const interval = setInterval(syncServerTime, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // finished => notify backend once
  useEffect(() => {
    if (view.mode !== "live") return;
    if (!questions.length) return;

    const total = questions.length;
    if (currentIdx < total) return;

    if (finishedSentRef.current) return;
    finishedSentRef.current = true;

    fetch("/api/admin/quiz-control/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quiz_id: view.quizId }),
    }).catch(() => {});
  }, [view.mode, view.quizId, questions.length, currentIdx]);

  // restore progress from DB
  const restoreProgressFromDb = useCallback(async (quizId) => {
    try {
      const userIdRaw = localStorage.getItem("user_id");
      const userId = Number(userIdRaw);
      if (!quizId) return;
      if (!userIdRaw || Number.isNaN(userId)) return;

      const { data: answers, error: aErr } = await supabase
        .from("quiz_answers")
        .select("question_id, choice_id, is_correct, answered_at")
        .eq("quiz_id", quizId)
        .eq("user_id", userId)
        .order("answered_at", { ascending: true });

      if (aErr) return;

      const pickedMap = {};
      const resultMap = {};
      const pendingMap = {};
      const lockedSet = new Set();

      for (const a of answers || []) {
        if (!a?.question_id) continue;
        pickedMap[a.question_id] = a.choice_id ?? null;

        const r = a.is_correct ? "correct" : "wrong";
        resultMap[a.question_id] = r;
        pendingMap[a.question_id] = r;

        lockedSet.add(a.question_id);
      }

      setPickedByQuestion(pickedMap);
      setResultByQuestion(resultMap);
      setPendingByQuestion(pendingMap);
      lockedQuestionsRef.current = lockedSet;

      const { data: scoreRow, error: sErr } = await supabase
        .from("quiz_scores")
        .select("score")
        .eq("quiz_id", quizId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!sErr && scoreRow?.score != null) setServerScore(scoreRow.score);

      // ✅ مهم: ما نقرأوش lifelines من localStorage نهائياً
      // لأن reset يمسح DB لكن localStorage يبقى ويخلي "مستعمل" دايماً.
      // نخليهم false هنا (الواقع يتحكم فيه API)
      setUsedHint(false);
      setUsed5050(false);
    } catch {}
  }, []);

  // load questions + settings (live)
  useEffect(() => {
    let mounted = true;

    async function loadQuestionsAndSettings(quizId) {
      setQLoading(true);

      setQuestions([]);
      setPickedByQuestion({});
      setResultByQuestion({});
      setPendingByQuestion({});
      lockedQuestionsRef.current = new Set();
      setCurrentIdx(0);
      setDisplayedIdx(0);
      setServerScore(null);
      setShowBoard(false);

      timeoutAppliedRef.current = new Set();
      setHiddenChoicesByQuestion({});
      setHintOpen(false);
      setHintText("");

      // ✅ Reset lifelines UI + تنظيف localStorage (حتى لو كان قديم)
      setUsedHint(false);
      setUsed5050(false);
      try {
        localStorage.removeItem(`lifeline_hint_${quizId}`);
        localStorage.removeItem(`lifeline_5050_${quizId}`);
      } catch {}

      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }

      const { data: settings } = await supabase
        .from("quiz_settings")
        .select("seconds_per_question")
        .eq("quiz_id", quizId)
        .maybeSingle();

      const seconds = Math.max(1, Number(settings?.seconds_per_question ?? 3));
      if (!mounted) return;
      setSecondsPerQuestion(seconds);
      setTimeLeft(seconds);

      const { data, error } = await supabase
        .from("questions")
        .select(
          `
          id,
          question_text,
          hint,
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
      await restoreProgressFromDb(quizId);
      setQLoading(false);
    }

    if (view.mode === "live" && view.quizId) loadQuestionsAndSettings(view.quizId);

    return () => {
      mounted = false;
    };
  }, [view.mode, view.quizId, restoreProgressFromDb]);

  // pre-countdown 10s
  const serverNowMs = Date.now() + serverOffsetMs;
  const preCountdown = useMemo(() => {
    if (!view?.startsAtMs) return { show: false, seconds: 0 };
    const diffMs = view.startsAtMs - serverNowMs;
    if (diffMs <= 0) return { show: false, seconds: 0 };
    if (diffMs <= 10_000) return { show: true, seconds: Math.ceil(diffMs / 1000) };
    return { show: false, seconds: 0 };
  }, [view?.startsAtMs, serverNowMs]);

  // sync current question/timeLeft (حسب وقت السيرفر)
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

  // ✅ Reveal + انتقال للسؤال الموالي:
  // عندما يتغير currentIdx => السؤال السابق انتهى
  useEffect(() => {
    if (view.mode !== "live") return;
    if (!questions.length) return;

    // أول مرة
    if (displayedIdx === currentIdx) return;

    const prevIdx = displayedIdx;
    const nextIdx = currentIdx;

    // إذا خرجنا من النطاق، خلّي displayed يتبع current
    if (prevIdx < 0 || prevIdx >= questions.length) {
      setDisplayedIdx(nextIdx);
      return;
    }

    const prevQ = questions[prevIdx];
    if (!prevQ?.id) {
      setDisplayedIdx(nextIdx);
      return;
    }

    const prevQid = prevQ.id;

    // 1) كشف النتيجة للسؤال السابق (مرة واحدة)
    const picked = pickedByQuestion[prevQid] ?? null;
    const pending = pendingByQuestion[prevQid] ?? null;

    const doReveal = async () => {
      // إذا ما جاوبش => timeout penalty عبر السيرفر
      if (!picked) {
        setResultByQuestion((p) => ({ ...p, [prevQid]: "timeout" }));

        if (!timeoutAppliedRef.current.has(prevQid)) {
          timeoutAppliedRef.current.add(prevQid);

          try {
            const sessionToken = localStorage.getItem("session_token");
            if (sessionToken && view.quizId) {
              const r = await apiFetch("/api/quiz/timeout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  session_token: sessionToken,
                  quiz_id: view.quizId,
                  question_id: prevQid,
                }),
              });

              if (r?.total_score != null) setServerScore(r.total_score);

              // penalty sound
              if (r?.penalty === -1) play("penalty");
            }
          } catch (e) {
            // حتى لو فشل، ما نحبسوش الواجهة
          }
        } else {
          play("penalty");
        }

        return;
      }

      // عنده إجابة: نكشف حسب pending
      if (pending === "correct") {
        setResultByQuestion((p) => ({ ...p, [prevQid]: "correct" }));
        play("correct");
      } else if (pending === "wrong") {
        setResultByQuestion((p) => ({ ...p, [prevQid]: "wrong" }));
        play("wrong");
      } else {
        // احتياط: إذا ما وصلناش pending لأي سبب
        setResultByQuestion((p) => ({ ...p, [prevQid]: "wrong" }));
        play("wrong");
      }
    };

    // 2) ثبت العرض على السؤال السابق لمدّة REVEAL_MS ثم انتقل
    setDisplayedIdx(prevIdx);

    // نفذ reveal مباشرة
    doReveal();

    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    revealTimerRef.current = setTimeout(() => {
      setDisplayedIdx(nextIdx);
      revealTimerRef.current = null;
    }, REVEAL_MS);

    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, view.mode, view.quizId, questions]);

  // score fallback
  const localScore = useMemo(() => {
    if (!questions.length) return 0;
    let s = 0;
    for (const q of questions) {
      if (resultByQuestion[q.id] === "correct") s += pointsFromLevel(q.level);
    }
    return s;
  }, [questions, resultByQuestion]);

  const scoreToShow = serverScore ?? localScore;

  const canPick = useCallback((questionId) => !lockedQuestionsRef.current.has(questionId), []);

  // ===== pick choice (API: /api/quiz/answer) =====
  async function pickChoice(question, choice) {
    if (userState !== 1) return;

    const sessionToken = localStorage.getItem("session_token");
    if (!sessionToken) {
      navigate("/login");
      return;
    }

    if (!view.quizId) return;
    if (!canPick(question.id)) return;

    // إذا نحن في مرحلة reveal (displayedIdx != currentIdx) ما نسمحش
    if (displayedIdx !== currentIdx) return;

    // وقت السؤال قرب يخلص؟ إذا timeLeft == 0 لا
    if (timeLeft <= 0) return;

    play("click");

    lockedQuestionsRef.current.add(question.id);
    setPickedByQuestion((prev) => ({ ...prev, [question.id]: choice.id }));

    try {
      const res = await apiFetch("/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: sessionToken,
          quiz_id: view.quizId,
          question_id: question.id,
          choice_id: choice.id,
        }),
      });

      // نخزن النتيجة pending فقط (بدون تلوين الآن)
      setPendingByQuestion((prev) => ({
        ...prev,
        [question.id]: res?.is_correct ? "correct" : "wrong",
      }));

      // server score يتبدل مباشرة (حتى لو ما نكشفش النتيجة الآن)
      if (res?.total_score != null) setServerScore(res.total_score);
    } catch (e) {
      console.error("answer api failed:", e);

      // رجّع القفل والاختيار
      lockedQuestionsRef.current.delete(question.id);
      setPickedByQuestion((prev) => {
        const copy = { ...prev };
        delete copy[question.id];
        return copy;
      });

      alert(e?.message || "تعذر حفظ الإجابة");
    }
  }

  // ===== Lifelines (API) =====
  const onUseHint = useCallback(async () => {
    if (usedHint) return;

    const sessionToken = localStorage.getItem("session_token");
    if (!sessionToken || !view.quizId) return;

    // لازم يكون سؤال معروض
    if (!questions.length) return;
    if (displayedIdx >= questions.length) return;
    const q = questions[displayedIdx];

    try {
      const r = await apiFetch("/api/quiz/use-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: sessionToken,
          quiz_id: view.quizId,
          question_id: q.id,
        }),
      });

      setUsedHint(true);
      // إبقاؤها اختيارية (لن نقرأها لاحقاً)
      try {
        localStorage.setItem(`lifeline_hint_${view.quizId}`, "1");
      } catch {}

      setHintText(String(r?.hint || ""));
      setHintOpen(true);
    } catch (e) {
      const msg = e?.message || "فشل تفعيل التلميح";
      alert(msg);
    }
  }, [usedHint, view.quizId, questions, displayedIdx]);

  const onUse5050 = useCallback(async () => {
    if (used5050) return;

    const sessionToken = localStorage.getItem("session_token");
    if (!sessionToken || !view.quizId) return;

    if (!questions.length) return;
    if (displayedIdx >= questions.length) return;
    const q = questions[displayedIdx];

    try {
      const r = await apiFetch("/api/quiz/use-fifty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: sessionToken,
          quiz_id: view.quizId,
          question_id: q.id,
        }),
      });

      setUsed5050(true);
      // إبقاؤها اختيارية (لن نقرأها لاحقاً)
      try {
        localStorage.setItem(`lifeline_5050_${view.quizId}`, "1");
      } catch {}

      const hideIds = Array.isArray(r?.hide_choice_ids) ? r.hide_choice_ids : [];
      setHiddenChoicesByQuestion((prev) => ({
        ...prev,
        [q.id]: hideIds,
      }));
    } catch (e) {
      const msg = e?.message || "فشل تفعيل 50/50";
      alert(msg);
    }
  }, [used5050, view.quizId, questions, displayedIdx]);

  // ===== UI gating =====
  if (stateLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <div className="rounded-2xl bg-white p-4 shadow">جاري التحقق من الحساب...</div>
      </div>
    );
  }

  if (userState !== 1) {
    const msg =
      userState === 0
        ? "حسابك قيد المراجعة. انتظر موافقة الإدارة."
        : userState === 2
        ? "تم رفض طلبك من طرف الإدارة."
        : userState === 3
        ? "تم حظر حسابك."
        : "لا يمكن الدخول.";

    return (
      <Wrapper onLogout={onLogout}>
        <div className="w-full max-w-lg rounded-2xl bg-white/90 p-6 shadow text-center">
          <h1 className="text-2xl font-bold mb-2">غير مسموح بالدخول</h1>
          <p className="text-slate-700">{msg}</p>

          <button
            onClick={onLogout}
            className="mt-4 w-full h-12 rounded-2xl bg-black/90 text-white shadow"
            type="button"
          >
            تسجيل الخروج
          </button>
        </div>
      </Wrapper>
    );
  }

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
        <NoQuizPanel
          username={username}
          onProfileUpdated={(u) => {
            if (u?.username) setUsername(u.username);
          }}
          onDeleted={() => navigate("/login", { replace: true })}
        />
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
        {showBoard ? <Leaderboard quizId={view.quizId} onClose={() => setShowBoard(false)} /> : null}

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

  const q = questions[Math.min(displayedIdx, questions.length - 1)];
  const qid = q?.id;

  const picked = qid ? pickedByQuestion[qid] ?? null : null;
  const revealed = qid ? resultByQuestion[qid] ?? null : null; // correct/wrong/timeout/null
  const locked = qid ? lockedQuestionsRef.current.has(qid) : true;

  const hiddenArr = qid && Array.isArray(hiddenChoicesByQuestion[qid]) ? hiddenChoicesByQuestion[qid] : [];
  const hiddenSet = new Set(hiddenArr);

  // نحن في reveal window إذا displayedIdx != currentIdx
  const inReveal = displayedIdx !== currentIdx;

  const revealClass =
    inReveal && revealed === "correct"
      ? "ring-2 ring-green-500 animate-pulse"
      : inReveal && (revealed === "wrong" || revealed === "timeout")
      ? "ring-2 ring-red-500 animate-[wiggle_0.35s_ease-in-out_1]"
      : "";

  const questionValue = pointsFromLevel(q.level);

  return (
    <Wrapper onLogout={onLogout}>
      <style>{`
        @keyframes wiggle {
          0% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          50% { transform: translateX(6px); }
          75% { transform: translateX(-4px); }
          100% { transform: translateX(0); }
        }
      `}</style>

      {/* Hint Modal */}
      {hintOpen ? (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
            <div className="text-lg font-bold mb-2">💡 التلميح</div>
            <div className="text-slate-700 leading-relaxed">
              {hintText || "لا يوجد تلميح لهذا السؤال."}
            </div>
            <button
              onClick={() => setHintOpen(false)}
              className="mt-4 w-full h-12 rounded-2xl bg-black/90 text-white"
              type="button"
            >
              إغلاق
            </button>
          </div>
        </div>
      ) : null}

      <div className={`w-full max-w-lg rounded-2xl bg-white/90 p-6 shadow ${revealClass}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-slate-700">
            سؤال {Math.min(displayedIdx + 1, total)} / {total}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm font-bold">⏱️ {inReveal ? 0 : timeLeft}s</div>
            <div className="text-sm font-semibold text-slate-800">النقاط: {scoreToShow}</div>
          </div>
        </div>

        {/* Lifelines */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            onClick={onUseHint}
            disabled={usedHint || inReveal}
            className={`h-10 px-3 rounded-xl border text-sm font-semibold transition ${
              usedHint || inReveal ? "opacity-50 bg-slate-100" : "bg-white hover:bg-slate-50"
            }`}
            type="button"
          >
            💡 تلميح (مرة)
          </button>

          <button
            onClick={onUse5050}
            disabled={used5050 || inReveal}
            className={`h-10 px-3 rounded-xl border text-sm font-semibold transition ${
              used5050 || inReveal ? "opacity-50 bg-slate-100" : "bg-white hover:bg-slate-50"
            }`}
            type="button"
          >
            ✂️ 50/50 (مرة)
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <span className="inline-flex items-center rounded-xl bg-slate-100 px-3 py-1 text-sm font-semibold">
            {q.level?.name ?? "مستوى"}
          </span>
          <span className="text-sm text-slate-600">قيمة السؤال: {questionValue}</span>
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-4 text-center">{q.question_text}</h2>

        <div className="grid gap-3">
          {(q.choices || [])
            .filter((c) => !hiddenSet.has(c.id))
            .map((c) => {
              const isPicked = picked === c.id;

              // ✅ قبل انتهاء الوقت: لا نلوّن صح/خطأ أبداً
              let extra = "";
              if (isPicked) extra = "border-slate-900 bg-slate-50";

              // ✅ أثناء reveal: نلوّن فقط الاختيار المختار
              if (inReveal && locked) {
                if (isPicked && revealed === "correct") extra = "border-green-600 bg-green-50";
                else if (isPicked && (revealed === "wrong" || revealed === "timeout"))
                  extra = "border-red-600 bg-red-50";
                else extra += " opacity-80";
              }

              return (
                <button
                  key={c.id}
                  onClick={() => pickChoice(q, c)}
                  className={`h-14 rounded-2xl border bg-white px-4 text-right shadow-sm transition ${extra}`}
                  disabled={locked || inReveal}
                  type="button"
                >
                  <span className="font-bold ml-2">{c.label}.</span>
                  {c.choice_text}
                </button>
              );
            })}
        </div>

        {/* Reveal message */}
        {inReveal ? (
          <div className="mt-4 text-center text-sm font-semibold">
            {revealed === "correct" ? (
              <span className="text-green-700">✅ إجابة صحيحة!</span>
            ) : revealed === "wrong" ? (
              <span className="text-red-700">❌ إجابة خاطئة!</span>
            ) : revealed === "timeout" ? (
              <span className="text-red-700">⏳ لم تجب… تم خصم نقطة</span>
            ) : (
              <span className="text-slate-600">—</span>
            )}
          </div>
        ) : (
          <div className="mt-5 text-center text-sm text-slate-600">
            {picked ? "تم حفظ اختيارك ✅ (النتيجة تظهر عند انتهاء الوقت)" : "اختر إجابة قبل انتهاء الوقت ⏳"}
          </div>
        )}
      </div>
    </Wrapper>
  );
}