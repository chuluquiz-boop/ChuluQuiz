import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import bg from "../assets/register-bg.png";
import NoQuizPanel from "../components/NoQuizPanel.jsx";
import { apiFetch } from "../lib/api.js";
import Leaderboard from "./Leaderboard.jsx";
import PartnersHeader from "../components/PartnersHeader.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
import { enablePushNotifications } from "../lib/firebasePush.js";

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
  const id = Number(level?.id);
  if (id === 1) return 1;
  if (id === 2) return 2;
  if (id === 3) return 3;
  return 1;
}

// ✅ مهم جداً: server_time() قد يرجع string أو object أو array
function parseServerTime(data) {
  if (!data) return null;

  if (typeof data === "string") return new Date(data);

  if (Array.isArray(data)) {
    const first = data[0];
    if (!first) return null;
    if (typeof first === "string") return new Date(first);

    const val =
      first?.server_time ||
      first?.now ||
      first?.time ||
      Object.values(first || {})[0];
    return val ? new Date(val) : null;
  }

  if (typeof data === "object") {
    const val = data.server_time || data.now || data.time || Object.values(data)[0];
    return val ? new Date(val) : null;
  }

  return null;
}

// ✅ parse قوي لـ starts_at (لتفادي Invalid Date في بعض الحالات)
function parseTsToMs(ts) {
  if (!ts) return null;

  if (ts instanceof Date) {
    const ms = ts.getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  const s = String(ts);

  let ms = Date.parse(s);
  if (Number.isFinite(ms)) return ms;

  // لو جا "YYYY-MM-DD HH:mm:ss" نحولو لـ ISO
  if (s.includes(" ") && !s.includes("T")) {
    ms = Date.parse(s.replace(" ", "T") + "Z");
    if (Number.isFinite(ms)) return ms;
  }

  return null;
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

  // ✅ دالة: تجيب session_token الخاص بالكويز إذا موجود، وإلا fallback للعام
  function getSessionTokenForQuiz(quizId) {
    try {
      if (quizId) {
        const t = localStorage.getItem(`quiz_${quizId}_session_token`);
        if (t) return t;
      }
      return localStorage.getItem("session_token");
    } catch {
      return localStorage.getItem("session_token");
    }
  }

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
  const [preCountdownSeconds, setPreCountdownSeconds] = useState(10);

  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  // currentIdx = المؤشر الحقيقي حسب وقت السيرفر
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(3);

  // displayedIdx = المؤشر اللي نعرضه فعلياً
  const [displayedIdx, setDisplayedIdx] = useState(0);

  const finishedSentRef = useRef(false);

  // ===== answers =====
  const [pickedByQuestion, setPickedByQuestion] = useState({});
  const [resultByQuestion, setResultByQuestion] = useState({});
  const [pendingByQuestion, setPendingByQuestion] = useState({});

  const [serverScore, setServerScore] = useState(null);

  // ===== Mini Leaderboard (حول اللاعب الحالي) =====
  const [miniBoard, setMiniBoard] = useState([]); // rows to render (max 5)
  const [myRank, setMyRank] = useState(null); // 1-based rank
  const [miniLoading, setMiniLoading] = useState(false);

  function computeMiniWindow(allRows, myIndex0) {
    // allRows sorted desc by score
    const n = allRows.length;
    if (n === 0) return { slice: [], rank: null };

    // إذا ما لقيناش اللاعب، نعرض Top5 كحل احتياطي
    if (myIndex0 < 0 || myIndex0 >= n) {
      return { slice: allRows.slice(0, 5), rank: null };
    }

    const rank = myIndex0 + 1;

    // نحدد البداية حسب القواعد
    let start = 0;

    if (myIndex0 === 0) start = 0; // الأول: هو + 4 تحت
    else if (myIndex0 === 1) start = 0; // الثاني: 1 فوق + هو + 3 تحت
    else if (myIndex0 >= n - 2) start = n - 5; // قبل الأخير/الأخير: نخليها آخر 5
    else start = myIndex0 - 2; // وسط: 2 فوق + هو + 2 تحت

    start = Math.max(0, Math.min(start, Math.max(0, n - 5)));
    const slice = allRows.slice(start, start + 5);

    return { slice, rank };
  }

  // ✅ لحساب سرعة الرد لكل سؤال
  const [questionStartMs, setQuestionStartMs] = useState(0);
  // نمنع اختيار أكثر من مرة للسؤال
  const lockedQuestionsRef = useRef(new Set());

  // ===== Lifelines =====
  const [usedHint, setUsedHint] = useState(false);
  const [used5050, setUsed5050] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [hintText, setHintText] = useState("");
  const [hiddenChoicesByQuestion, setHiddenChoicesByQuestion] = useState({});

  // timeout penalty once per question
  const timeoutAppliedRef = useRef(new Set());

  // reveal control
  const REVEAL_MS = 1200;
  const revealTimerRef = useRef(null);

  // ✅ Beep control (مرة لكل ثانية)
  const lastBeepSecondRef = useRef(null);

  // ===== Sounds =====
  const sfx = useRef({
    click: null,
    correct: null,
    wrong: null,
    penalty: null,
    beep: null,
  });

  useEffect(() => {
    sfx.current.click = new Audio("/sfx/click.mp3");
    sfx.current.correct = new Audio("/sfx/correct-clap.mp3");
    sfx.current.wrong = new Audio("/sfx/wrong.mp3");
    sfx.current.penalty = new Audio("/sfx/penalty.mp3");
    sfx.current.beep = new Audio("/sfx/beep.mp3");

    for (const k of Object.keys(sfx.current)) {
      try {
        if (!sfx.current[k]) continue;
        sfx.current[k].preload = "auto";
        sfx.current[k].volume = 0.8;
      } catch { }
    }
  }, []);

  const play = useCallback((name) => {
    try {
      const a = sfx.current[name];
      if (!a) return;
      a.currentTime = 0;
      a.play().catch(() => { });
    } catch { }
  }, []);

  // ✅ view يعتمد على serverNowMs + parseTsToMs
  const safeOffset = Number.isFinite(serverOffsetMs) ? serverOffsetMs : 0;
  const serverNowMs = Date.now() + safeOffset;

  // quiz_control view
  const view = useMemo(() => {
    if (!ctrl) return { mode: "none" };
    const status = ctrl.status;
    const startsAtMs = parseTsToMs(ctrl.starts_at);

    if (!ctrl.active_quiz_id) return { mode: "none", reason: "no_active_quiz" };

    if (status === "finished")
      return { mode: "finished", quizId: ctrl.active_quiz_id, startsAtMs };

    if (status === "live") return { mode: "live", quizId: ctrl.active_quiz_id, startsAtMs };

    if (status === "scheduled" && startsAtMs) {
      const diff = startsAtMs - serverNowMs;
      if (diff <= 0) return { mode: "live", quizId: ctrl.active_quiz_id, startsAtMs };
      return { mode: "scheduled", diffMs: diff, startsAtMs, quizId: ctrl.active_quiz_id };
    }

    return { mode: "none" };
  }, [ctrl, serverNowMs]);

  // ===== Logout =====
  const onLogout = useCallback(async () => {
    const ok = window.confirm("هل تريد تسجيل الخروج؟");
    if (!ok) return;

    const sessionToken = getSessionTokenForQuiz(view?.quizId);

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

    // ✅ حذف عام
    localStorage.removeItem("session_token");
    localStorage.removeItem("quiz_token");
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");

    // ✅ حذف خاص بالكويز (جلسة مؤقتة لكل كويز)
    if (view?.quizId) {
      localStorage.removeItem(`quiz_${view.quizId}_session_token`);
      localStorage.removeItem(`quiz_${view.quizId}_user_id`);
      localStorage.removeItem(`quiz_${view.quizId}_username`);
    }

    setShowBoard(false);
    navigate("/login", { replace: true });
  }, [navigate, view?.quizId]); // ✅ مهم: أضفنا view.quizId

  // ✅ لازم token
  useEffect(() => {
    const sessionToken = getSessionTokenForQuiz(view?.quizId);
    if (!sessionToken) navigate("/login");
  }, [navigate, view?.quizId]);

  // تحقق state + polling
  useEffect(() => {
    let alive = true;

    async function checkState() {
      const sessionToken = getSessionTokenForQuiz(view?.quizId);
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

        if (view?.quizId) {
          localStorage.removeItem(`quiz_${view.quizId}_session_token`);
          localStorage.removeItem(`quiz_${view.quizId}_user_id`);
          localStorage.removeItem(`quiz_${view.quizId}_username`);
        }

        navigate("/login", { replace: true });
      }
    }

    checkState();
    const t = setInterval(checkState, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [navigate, view?.quizId]);

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

      if (error || !data)
        setCtrl({ status: "none", starts_at: null, active_quiz_id: null });
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

  // ===== Load mini leaderboard during LIVE =====
  useEffect(() => {
    if (view.mode !== "live") {
      setMiniBoard([]);
      setMyRank(null);
      return;
    }
    if (!view.quizId) return;

    let mounted = true;
    let timer = null;

    async function loadMini() {
      try {
        setMiniLoading(true);

        const userIdRaw = localStorage.getItem("user_id");
        const userId = Number(userIdRaw);

        if (!userIdRaw || Number.isNaN(userId)) {
          if (!mounted) return;
          setMiniBoard([]);
          setMyRank(null);
          return;
        }

        const { data, error } = await supabase
          .from("quiz_leaderboard")
          .select("user_id,username,score")
          .eq("quiz_id", view.quizId)
          .order("score", { ascending: false })
          .limit(500);

        if (!mounted) return;

        if (error) {
          console.warn("mini leaderboard error:", error);
          setMiniBoard([]);
          setMyRank(null);
          return;
        }

        const rows = Array.isArray(data) ? data : [];
        const myIndex0 = rows.findIndex((r) => Number(r.user_id) === Number(userId));

        const { slice, rank } = computeMiniWindow(rows, myIndex0);

        setMiniBoard(slice);
        setMyRank(rank);
      } catch (e) {
        console.warn("mini leaderboard load failed:", e);
        if (!mounted) return;
        setMiniBoard([]);
        setMyRank(null);
      } finally {
        if (mounted) setMiniLoading(false);
      }
    }

    loadMini();
    timer = setInterval(loadMini, 3000);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [view.mode, view.quizId]);

  // ✅ تحميل settings بمجرد وجود quizId (حتى في scheduled)
  useEffect(() => {
    let mounted = true;

    async function ensureAndLoadSettings(quizId) {
      try {
        await supabase.from("quiz_settings").upsert({ quiz_id: quizId }, { onConflict: "quiz_id" });

        const { data: settings, error } = await supabase
          .from("quiz_settings")
          .select("seconds_per_question, pre_countdown_seconds")
          .eq("quiz_id", quizId)
          .maybeSingle();

        if (!mounted) return;
        if (error) {
          console.warn("settings load error:", error);
          return;
        }

        const seconds = Math.max(1, Number(settings?.seconds_per_question ?? 3));
        const preSec = Math.max(0, Number(settings?.pre_countdown_seconds ?? 10));

        setSecondsPerQuestion(seconds);
        setTimeLeft(seconds);
        setPreCountdownSeconds(preSec);
      } catch (e) {
        console.warn("ensureAndLoadSettings failed:", e);
      }
    }

    if (view?.quizId) ensureAndLoadSettings(view.quizId);

    return () => {
      mounted = false;
    };
  }, [view?.quizId]);

  // sync server time
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
    }).catch(() => { });
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
        .select("question_id, choice_id, is_correct, is_timeout, answered_at")
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

        const isTimeout = !!a.is_timeout || (a.choice_id == null && !a.is_correct);

        pickedMap[a.question_id] = a.choice_id ?? null;

        const r = isTimeout ? "timeout" : a.is_correct ? "correct" : "wrong";
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

      setUsedHint(false);
      setUsed5050(false);
    } catch { }
  }, []);

  // load questions (live فقط)
  useEffect(() => {
    let mounted = true;

    async function loadQuestions(quizId) {
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

      setUsedHint(false);
      setUsed5050(false);
      try {
        localStorage.removeItem(`lifeline_hint_${quizId}`);
        localStorage.removeItem(`lifeline_5050_${quizId}`);
      } catch { }

      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }

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

    if (view.mode === "live" && view.quizId) loadQuestions(view.quizId);

    return () => {
      mounted = false;
    };
  }, [view.mode, view.quizId, restoreProgressFromDb]);

  // ✅ pre-countdown (يعتمد على serverNowMs) — من settings
  const preCountdown = useMemo(() => {
    if (!view?.startsAtMs) return { show: false, seconds: 0 };
    const diffMs = view.startsAtMs - serverNowMs;
    if (diffMs <= 0) return { show: false, seconds: 0 };

    const windowMs = Math.max(0, Number(preCountdownSeconds) || 0) * 1000;

    if (windowMs <= 0) return { show: false, seconds: 0 };

    if (diffMs <= windowMs) return { show: true, seconds: Math.ceil(diffMs / 1000) };
    return { show: false, seconds: 0 };
  }, [view?.startsAtMs, serverNowMs, preCountdownSeconds]);

  // sync current question/timeLeft (حسب وقت السيرفر)
  useEffect(() => {
    if (view.mode !== "live") return;
    if (!questions.length) return;
    const startsAtMs = view.startsAtMs;
    if (!startsAtMs || !Number.isFinite(startsAtMs)) return;

    let intervalId = null;

    const tick = () => {
      const total = questions.length;
      const serverNow = Date.now() + safeOffset;
      const elapsedMs = serverNow - startsAtMs;

      if (!Number.isFinite(elapsedMs)) {
        setCurrentIdx(0);
        setTimeLeft(secondsPerQuestion);
        return;
      }

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
  }, [view.mode, view.startsAtMs, questions.length, secondsPerQuestion, safeOffset]);

  // ✅ Reveal + انتقال للسؤال الموالي
  useEffect(() => {
    if (view.mode !== "live") return;
    if (!questions.length) return;

    if (displayedIdx === currentIdx) return;

    const prevIdx = displayedIdx;
    const nextIdx = currentIdx;

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
    const picked = pickedByQuestion[prevQid] ?? null;
    const pending = pendingByQuestion[prevQid] ?? null;

    const doReveal = async () => {
      if (!picked) {
        setResultByQuestion((p) => ({ ...p, [prevQid]: "timeout" }));

        if (!timeoutAppliedRef.current.has(prevQid)) {
          timeoutAppliedRef.current.add(prevQid);

          try {
            const sessionToken = getSessionTokenForQuiz(view?.quizId);
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
              if (r?.penalty === -1) play("penalty");
            }
          } catch { }
        } else {
          play("penalty");
        }

        return;
      }

      if (pending === "correct") {
        setResultByQuestion((p) => ({ ...p, [prevQid]: "correct" }));
        play("correct");
      } else if (pending === "wrong") {
        setResultByQuestion((p) => ({ ...p, [prevQid]: "wrong" }));
        play("wrong");
      } else {
        setResultByQuestion((p) => ({ ...p, [prevQid]: "wrong" }));
        play("wrong");
      }
    };

    setDisplayedIdx(prevIdx);
    doReveal();

    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    revealTimerRef.current = setTimeout(() => {
      setDisplayedIdx(nextIdx);
      lastBeepSecondRef.current = null;
      revealTimerRef.current = null;
    }, REVEAL_MS);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, view.mode, view.quizId, questions]);

  // ✅ Reset beep عند دخول سؤال جديد
  useEffect(() => {
    lastBeepSecondRef.current = null;
  }, [displayedIdx]);

  // ✅ كل مرة نعرض سؤال جديد نسجل وقت بدايته
  useEffect(() => {
    setQuestionStartMs(performance.now());
  }, [displayedIdx]);

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

  // ===== pick choice (API) =====
  async function pickChoice(question, choice) {
    if (userState !== 1) return;

    const sessionToken = getSessionTokenForQuiz(view?.quizId);
    if (!sessionToken) {
      navigate("/login");
      return;
    }

    if (!view.quizId) return;
    if (!canPick(question.id)) return;

    if (displayedIdx !== currentIdx) return;
    if (timeLeft <= 0) return;

    play("click");

    lockedQuestionsRef.current.add(question.id);
    setPickedByQuestion((prev) => ({ ...prev, [question.id]: choice.id }));
    const reactionMs = Math.max(0, Math.round(performance.now() - questionStartMs));

    try {
      const res = await apiFetch("/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: sessionToken,
          quiz_id: view.quizId,
          question_id: question.id,
          choice_id: choice.id,
          reaction_ms: reactionMs,
        }),
      });

      setPendingByQuestion((prev) => ({
        ...prev,
        [question.id]: res?.is_correct ? "correct" : "wrong",
      }));

      if (res?.total_score != null) setServerScore(res.total_score);
    } catch (e) {
      console.error("answer api failed:", e);

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

    const sessionToken = getSessionTokenForQuiz(view?.quizId);
    if (!sessionToken || !view.quizId) return;

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
      try {
        localStorage.setItem(`lifeline_hint_${view.quizId}`, "1");
      } catch { }

      setHintText(String(r?.hint || ""));
      setHintOpen(true);
    } catch (e) {
      alert(e?.message || "فشل تفعيل التلميح");
    }
  }, [usedHint, view?.quizId, questions, displayedIdx]);

  const onUse5050 = useCallback(async () => {
    if (used5050) return;

    const sessionToken = getSessionTokenForQuiz(view?.quizId);
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
      try {
        localStorage.setItem(`lifeline_5050_${view.quizId}`, "1");
      } catch { }

      const hideIds = Array.isArray(r?.hide_choice_ids) ? r.hide_choice_ids : [];
      setHiddenChoicesByQuestion((prev) => ({
        ...prev,
        [q.id]: hideIds,
      }));
    } catch (e) {
      alert(e?.message || "فشل تفعيل 50/50");
    }
  }, [used5050, view?.quizId, questions, displayedIdx]);

  // ✅ beep: في آخر 3 ثواني (3/2/1) مرة واحدة لكل ثانية
  const inRevealForBeep = displayedIdx !== currentIdx;

  useEffect(() => {
    if (view.mode !== "live") return;
    if (inRevealForBeep) return;

    const t = Number(timeLeft);
    if (!Number.isFinite(t)) return;

    if (t > 0 && t <= 3) {
      if (lastBeepSecondRef.current !== t) {
        lastBeepSecondRef.current = t;
        play("beep");
      }
    }
  }, [timeLeft, view.mode, inRevealForBeep, play]);

  useEffect(() => {
    lastBeepSecondRef.current = null;
  }, [displayedIdx]);

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
        <SiteFooter />
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

  if (view.mode === "none" || view.mode === "finished") {
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
        <SiteFooter />
      </Wrapper>
    );
  }

  if (view.mode === "scheduled") {
    const { h, m, s } = msToParts(view.diffMs);
    return (
      <Wrapper onLogout={onLogout}>
        <div className="w-full max-w-lg rounded-2xl bg-white/90 p-6 shadow text-center -mt-14">
          <h1 className="text-2xl font-bold mb-2">الكويز مجدول</h1>
          <button
            onClick={async () => {
              try {
                const r = await enablePushNotifications();
                if (r.ok) alert("✅ تم تفعيل الإشعارات");
                else alert("❌ لم يتم التفعيل: " + r.reason);
              } catch (e) {
                alert("❌ خطأ: " + (e?.message || "حدث خطأ"));
              }
            }}
            className="mt-3 w-full h-12 rounded-2xl bg-black text-white font-semibold"
          >
            🔔 فعّل إشعارات الكويز
          </button>
          <p className="mb-5 text-red-600 font-extrabold text-xl">
            سيبدأ تلقائيًا عند الوصول للساعة العاشرة ليلا
          </p>
          <p className="text-slate-600 mb-5">
            انتظروا كويز سهرة الاثنين  .. كويز مميز  .. أسئلة سيكون بعضها كما وعدناكم من كويز السهرة الماضية و أسئلة أخرى ستكون من حلقة البودكاست المسائي الذي يبثه
            AYMEN PHOTOGRAPHE PROD
            انتظرونا هناك جوائز هده المرة
          </p>

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
  const revealed = qid ? resultByQuestion[qid] ?? null : null;
  const locked = qid ? lockedQuestionsRef.current.has(qid) : true;

  const hiddenArr =
    qid && Array.isArray(hiddenChoicesByQuestion[qid]) ? hiddenChoicesByQuestion[qid] : [];
  const hiddenSet = new Set(hiddenArr);

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
        @keyframes countdownPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
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
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-slate-700">
              سؤال {Math.min(displayedIdx + 1, total)} / {total}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={[
                    "flex items-center justify-center",
                    "min-w-[104px] h-12 sm:h-14",
                    "rounded-2xl px-3",
                    "font-extrabold tabular-nums",
                    "border shadow-sm",
                    "text-2xl sm:text-3xl",
                    "transition",
                    !inReveal && timeLeft <= 3
                      ? "bg-red-50 border-red-300 text-red-700 animate-[countdownPulse_0.85s_ease-in-out_infinite]"
                      : "bg-slate-50 border-slate-200 text-slate-900",
                    !inReveal && timeLeft <= 3 ? "shadow-[0_0_0_6px_rgba(239,68,68,0.12)]" : "",
                  ].join(" ")}
                  aria-label="عداد الوقت"
                  title="الوقت المتبقي"
                >
                  ⏱️ {inReveal ? 0 : timeLeft}
                </div>
                <span className="text-xs sm:text-sm text-slate-600">ث</span>
              </div>

              <div className="text-sm font-semibold text-slate-800">النقاط: {scoreToShow}</div>
            </div>
          </div>

          <div className="mt-3">
            <div className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-slate-700">ترتيبك</div>
                <div className="text-xs text-slate-500">
                  {miniLoading ? "..." : myRank ? `#${myRank}` : "—"}
                </div>
              </div>

              <div className="space-y-1">
                {(miniBoard || []).map((r) => {
                  const isMe = Number(r.user_id) === Number(localStorage.getItem("user_id"));
                  return (
                    <div
                      key={r.user_id}
                      className={[
                        "flex items-center justify-between rounded-lg px-2 py-1 text-xs",
                        isMe ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-800",
                      ].join(" ")}
                    >
                      <div className="truncate max-w-[70%]">
                        {isMe ? "أنت" : r.username || "—"}
                      </div>
                      <div className="font-bold tabular-nums">{r.score ?? 0}</div>
                    </div>
                  );
                })}

                {!miniLoading && (!miniBoard || miniBoard.length === 0) ? (
                  <div className="text-xs text-slate-500">لا يوجد ترتيب بعد</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Lifelines */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            onClick={onUseHint}
            disabled={usedHint || inReveal}
            className={`h-10 px-3 rounded-xl border text-sm font-semibold transition ${usedHint || inReveal ? "opacity-50 bg-slate-100" : "bg-white hover:bg-slate-50"
              }`}
            type="button"
          >
            💡 تلميح (مرة)
          </button>

          <button
            onClick={onUse5050}
            disabled={used5050 || inReveal}
            className={`h-10 px-3 rounded-xl border text-sm font-semibold transition ${used5050 || inReveal ? "opacity-50 bg-slate-100" : "bg-white hover:bg-slate-50"
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

              let extra = "";
              if (isPicked) extra = "border-slate-900 bg-slate-50";

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
        <SiteFooter />
      </div>
    </Wrapper>
  );
}