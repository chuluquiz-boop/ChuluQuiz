import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { Card, CardBody, Button, Select, Input } from "../../components/ui.jsx";

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function pct(n, d) {
  if (!d) return "0%";
  return `${Math.round((n / d) * 100)}%`;
}

export default function AdminLeaderboard() {
  const API = import.meta.env.VITE_API_URL;

  const [quizzes, setQuizzes] = useState([]);
  const [quizId, setQuizId] = useState("");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [q, setQ] = useState("");

  // modal
  const [openUserId, setOpenUserId] = useState(null);
  const [openUser, setOpenUser] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [answersScore, setAnswersScore] = useState(0);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answersErr, setAnswersErr] = useState("");

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
      // auto pick newest
      if (!quizId && (data.quizzes || []).length) {
        setQuizId(data.quizzes[0].id);
      }
    } catch (e) {
      setMsg(e.message || "Failed to load quizzes");
      setQuizzes([]);
    }
  }

  async function loadLeaderboard(qid) {
    if (!qid) return;
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`${API}/api/admin/leaderboard?quiz_id=${encodeURIComponent(qid)}`);
      const data = await safeJson(res);
      if (!res.ok || !data.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setRows(data.rows || []);
    } catch (e) {
      setMsg(e.message || "Failed to load leaderboard");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuizzes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadLeaderboard(quizId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return (rows || []).filter((r) => {
      return (
        String(r.username || "").toLowerCase().includes(query) ||
        String(r.phone || "").toLowerCase().includes(query) ||
        String(r.user_id || "").toLowerCase().includes(query)
      );
    });
  }, [rows, q]);

  async function openAnswers(userId) {
    if (!quizId || !userId) return;
    setOpenUserId(userId);
    setOpenUser(null);
    setAnswers([]);
    setAnswersScore(0);
    setAnswersErr("");
    setAnswersLoading(true);

    try {
      const res = await fetch(
        `${API}/api/admin/user-answers?quiz_id=${encodeURIComponent(quizId)}&user_id=${encodeURIComponent(
          userId
        )}`
      );
      const data = await safeJson(res);
      if (!res.ok || !data.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      setOpenUser(data.user || null);
      setAnswersScore(Number(data.score || 0));
      setAnswers(data.rows || []);
    } catch (e) {
      setAnswersErr(e.message || "Failed to load answers");
    } finally {
      setAnswersLoading(false);
    }
  }

  function closeModal() {
    setOpenUserId(null);
    setOpenUser(null);
    setAnswers([]);
    setAnswersScore(0);
    setAnswersErr("");
    setAnswersLoading(false);
  }

  const quizTitle = useMemo(() => {
    const qz = (quizzes || []).find((x) => x.id === quizId);
    return qz?.title || "—";
  }, [quizzes, quizId]);

  const summary = useMemo(() => {
    const total = (rows || []).length;
    const top = rows?.[0]?.score ?? 0;
    const avg = total ? Math.round((rows || []).reduce((a, r) => a + Number(r.score || 0), 0) / total) : 0;
    return { total, top, avg };
  }, [rows]);

  return (
    <AdminLayout title="Admin Leaderboard" subtitle="اختر كويز وشاهد ترتيب المشاركين + تفاصيل إجابات كل لاعب">
      <div className="grid gap-4">
        {msg && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{msg}</div>
        )}

        <Card>
          <CardBody className="grid gap-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <Select label="Quiz" value={quizId} onChange={(e) => setQuizId(e.target.value)}>
                <option value="">-- Select Quiz --</option>
                {quizzes.map((qz) => (
                  <option key={qz.id} value={qz.id}>
                    {qz.title} ({qz.status})
                  </option>
                ))}
              </Select>

              <Input label="Search" placeholder="username / phone / id" value={q} onChange={(e) => setQ(e.target.value)} />

              <div className="grid content-end">
                <Button variant="soft" onClick={() => loadLeaderboard(quizId)} disabled={loading || !quizId}>
                  🔄 Refresh
                </Button>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Quiz</div>
                <div className="font-semibold mt-1 truncate">{quizTitle}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Players</div>
                <div className="font-semibold mt-1">{summary.total}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Top / Avg</div>
                <div className="font-semibold mt-1">
                  {summary.top} / {summary.avg}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr className="text-left">
                  <th className="p-3">#</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Updated</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td className="p-4 text-slate-500" colSpan={6}>
                      جاري التحميل...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td className="p-4 text-slate-500" colSpan={6}>
                      لا توجد نتائج
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.user_id} className="border-t hover:bg-slate-50">
                      <td className="p-3 font-semibold">{r.rank}</td>
                      <td className="p-3">
                        <div className="font-medium text-slate-900">{r.username}</div>
                        <div className="text-xs text-slate-500">{String(r.user_id)}</div>
                      </td>
                      <td className="p-3 font-mono text-xs">{r.phone}</td>
                      <td className="p-3 font-bold">{r.score}</td>
                      <td className="p-3 text-xs text-slate-500">{fmtDate(r.updated_at)}</td>
                      <td className="p-3">
                        <Button variant="soft" onClick={() => openAnswers(r.user_id)}>
                          View Answers
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {openUserId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
            <button onClick={closeModal} className="absolute inset-0 bg-black/50" aria-label="close" />

            <div className="relative w-full max-w-4xl rounded-2xl bg-white p-5 shadow-xl">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-lg font-bold">إجابات اللاعب</div>
                  <div className="text-sm text-slate-500 mt-1">
                    {openUser?.username || "—"} • {openUser?.phone || "—"} • Score: {answersScore}
                  </div>
                </div>

                <Button variant="soft" onClick={closeModal}>
                  إغلاق
                </Button>
              </div>

              {answersLoading ? (
                <div className="text-center text-slate-600 py-8">جاري التحميل...</div>
              ) : answersErr ? (
                <div className="text-center text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
                  {answersErr}
                </div>
              ) : answers.length === 0 ? (
                <div className="text-center text-slate-600 py-8">لا توجد إجابات بعد</div>
              ) : (
                <div className="overflow-hidden rounded-2xl border mt-3">
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr className="text-left">
                          <th className="p-3">#</th>
                          <th className="p-3">Question</th>
                          <th className="p-3">Chosen</th>
                          <th className="p-3">Correct</th>
                          <th className="p-3">Points</th>
                          <th className="p-3">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {answers.map((a) => (
                          <tr key={`${a.question_id}-${a.index}`} className="border-t">
                            <td className="p-3 font-semibold">{a.index}</td>
                            <td className="p-3">
                              <div className="font-medium text-slate-900">{a.question_text}</div>
                              <div className="text-xs text-slate-500">Level: {a.level_id ?? "—"}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-semibold">{a.chosen?.label}</div>
                              <div className="text-xs text-slate-600">{a.chosen?.text}</div>
                            </td>
                            <td className="p-3">
                              {a.correct ? (
                                <>
                                  <div className="font-semibold">{a.correct.label}</div>
                                  <div className="text-xs text-slate-600">{a.correct.text}</div>
                                </>
                              ) : (
                                <span className="text-xs text-slate-500">—</span>
                              )}
                            </td>
                            <td className="p-3">
                              <div className={`font-bold ${a.is_correct ? "text-emerald-700" : "text-rose-700"}`}>
                                {a.points_awarded}
                              </div>
                              <div className="text-xs text-slate-500">{a.is_correct ? "Correct" : "Wrong"}</div>
                            </td>
                            <td className="p-3 text-xs text-slate-500">{fmtDate(a.answered_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!answersLoading && answers.length > 0 && (
                <div className="mt-4 text-xs text-slate-500">
                  إجابات صحيحة: <b>{answers.filter((x) => x.is_correct).length}</b> / {answers.length} (
                  {pct(answers.filter((x) => x.is_correct).length, answers.length)})
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}