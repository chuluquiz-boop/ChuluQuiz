import { useEffect, useMemo, useRef, useState } from "react";
import AdminLayout from "./AdminLayout";
import { Card, CardBody, Button, Select } from "../../components/ui.jsx";

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function clamp01(x) {
  const n = Number(x);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export default function LiveStats() {
  const API = import.meta.env.VITE_API_URL;

  const [quizzes, setQuizzes] = useState([]);
  const [quizId, setQuizId] = useState("");

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [intervalMs, setIntervalMs] = useState(2000);
  const timerRef = useRef(null);

  async function safeJson(res) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    const text = await res.text();
    throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 160)}`);
  }

  async function loadQuizzes() {
    try {
      const res = await fetch(`${API}/api/admin/quizzes`);
      const data = await safeJson(res);
      if (!res.ok || !data.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setQuizzes(data.quizzes || []);
      if (!quizId && (data.quizzes || []).length) {
        setQuizId(data.quizzes[0].id);
      }
    } catch (e) {
      setMsg(e.message || "Failed to load quizzes");
      setQuizzes([]);
    }
  }

  async function loadStats(qid) {
    setLoading(true);
    setMsg("");
    try {
      const url = qid
        ? `${API}/api/admin/live-stats?quiz_id=${encodeURIComponent(qid)}`
        : `${API}/api/admin/live-stats`;

      const res = await fetch(url);
      const data = await safeJson(res);
      if (!res.ok || !data.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      setPayload(data);
      // إذا رجع active quiz من السيرفر
      if (!qid && data.quiz_id) setQuizId(data.quiz_id);
    } catch (e) {
      setMsg(e.message || "Failed to load stats");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuizzes();
    loadStats(""); // auto: active quiz
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (quizId) loadStats(quizId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  useEffect(() => {
    if (!autoRefresh) return;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      loadStats(quizId);
    }, Math.max(1000, Number(intervalMs) || 2000));

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, intervalMs, quizId]);

  const control = payload?.control || null;
  const quiz = payload?.quiz || null;
  const stats = payload?.stats || null;

  const statusBadge = useMemo(() => {
    const s = control?.status;
    if (s === "live") return { text: "LIVE", cls: "bg-rose-100 text-rose-700 border-rose-200" };
    if (s === "scheduled") return { text: "SCHEDULED", cls: "bg-amber-100 text-amber-700 border-amber-200" };
    return { text: "NONE", cls: "bg-slate-100 text-slate-700 border-slate-200" };
  }, [control?.status]);

  return (
    <AdminLayout title="Live Stats" subtitle="مراقبة مباشرة: اللاعبين/الإجابات/Top 10 + تقدم كل سؤال (Polling)">
      <div className="grid gap-4">
        {msg && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{msg}</div>
        )}

        <Card>
          <CardBody className="grid gap-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <Select label="Quiz" value={quizId} onChange={(e) => setQuizId(e.target.value)}>
                <option value="">(Auto: active quiz)</option>
                {quizzes.map((qz) => (
                  <option key={qz.id} value={qz.id}>
                    {qz.title} ({qz.status})
                  </option>
                ))}
              </Select>

              <Select label="Auto refresh" value={autoRefresh ? "on" : "off"} onChange={(e) => setAutoRefresh(e.target.value === "on")}>
                <option value="on">ON</option>
                <option value="off">OFF</option>
              </Select>

              <Select
                label="Interval"
                value={String(intervalMs)}
                onChange={(e) => setIntervalMs(Number(e.target.value))}
                disabled={!autoRefresh}
              >
                <option value="1000">1s</option>
                <option value="2000">2s</option>
                <option value="3000">3s</option>
                <option value="5000">5s</option>
              </Select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${statusBadge.cls}`}>
                  {statusBadge.text}
                </span>
                <div className="text-xs text-slate-500">
                  starts_at: <span className="font-mono">{fmtDate(control?.starts_at)}</span>
                </div>
              </div>

              <Button variant="soft" onClick={() => loadStats(quizId)} disabled={loading}>
                🔄 Refresh now
              </Button>
            </div>
          </CardBody>
        </Card>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardBody className="grid gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-500">Active quiz</div>
                  <div className="text-lg font-semibold mt-1">{quiz?.title || "—"}</div>
                  <div className="text-xs text-slate-500 mt-1">quiz_id: {payload?.quiz_id || "—"}</div>
                </div>

                {loading ? (
                  <div className="text-xs text-slate-500">Loading…</div>
                ) : (
                  <div className="text-xs text-slate-500">Updated: {fmtDate(control?.updated_at)}</div>
                )}
              </div>

              {!stats ? (
                <div className="text-slate-600 text-sm">لا توجد إحصائيات (ربما لا يوجد active quiz).</div>
              ) : (
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">Players</div>
                    <div className="text-2xl font-bold mt-1">{stats.players_count}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">Answers</div>
                    <div className="text-2xl font-bold mt-1">{stats.answers_count}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">Questions</div>
                    <div className="text-2xl font-bold mt-1">{stats.questions_count}</div>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="grid gap-3">
              <div className="text-sm font-semibold">🏆 Top 10</div>
              {!stats ? (
                <div className="text-xs text-slate-500">—</div>
              ) : stats.top.length === 0 ? (
                <div className="text-xs text-slate-500">لا يوجد ترتيب بعد</div>
              ) : (
                <div className="overflow-hidden rounded-2xl border">
                  <div className="max-h-80 overflow-auto">
                    {stats.top.map((r) => (
                      <div key={r.user_id} className="grid grid-cols-12 px-3 py-2 text-sm border-t first:border-t-0">
                        <div className="col-span-2 font-bold">{r.rank}</div>
                        <div className="col-span-7 truncate">{r.username}</div>
                        <div className="col-span-3 text-left font-bold">{r.score}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">📊 Question progress</div>
                <div className="text-xs text-slate-500 mt-1">نسبة الإجابة لكل سؤال + نسبة الصح</div>
              </div>
              {stats && (
                <div className="text-xs text-slate-500">
                  Players: <b>{stats.players_count}</b>
                </div>
              )}
            </div>

            {!stats ? (
              <div className="text-sm text-slate-600">—</div>
            ) : stats.question_stats.length === 0 ? (
              <div className="text-sm text-slate-600">لا توجد أسئلة لهذا الكويز</div>
            ) : (
              <div className="grid gap-3">
                {stats.question_stats.map((q) => {
                  const prog = clamp01(q.progress);
                  const corr = clamp01(q.correct_rate);
                  return (
                    <div key={q.question_id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Q{q.index} (Level {q.level_id})</div>
                          <div className="text-sm text-slate-700 mt-1">{q.question_text}</div>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          <div>answered: <b>{q.answered}</b></div>
                          <div>correct: <b>{q.correct}</b></div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2">
                        <div>
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Progress</span>
                            <span className="font-mono">{Math.round(prog * 100)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-slate-900" style={{ width: `${prog * 100}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Correct rate</span>
                            <span className="font-mono">{Math.round(corr * 100)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-emerald-600" style={{ width: `${corr * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  );
}