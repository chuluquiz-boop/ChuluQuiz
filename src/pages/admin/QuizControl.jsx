import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import AdminLayout from "./AdminLayout";
import { Card, CardBody, Button, Select, Input } from "../../components/ui.jsx";
import { apiFetch } from "../../lib/api";

function parseServerTime(data) {
  if (!data) return null;

  if (typeof data === "string") return new Date(data);

  if (Array.isArray(data)) {
    const first = data[0];
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

export default function QuizControl() {
  const [quizzes, setQuizzes] = useState([]); // {id,title,status}
  const [control, setControl] = useState(null);

  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState(""); // datetime-local
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const selectedQuiz = useMemo(() => {
    return quizzes.find((q) => q.id === selectedQuizId) || null;
  }, [quizzes, selectedQuizId]);

  const isSelectedActive = useMemo(() => {
    if (!selectedQuizId) return false;
    return selectedQuizId === (control?.active_quiz_id || "");
  }, [selectedQuizId, control?.active_quiz_id]);

  // ✅ الحالة المعروضة في UI حسب الكويز المختار
  const uiStatus = useMemo(() => {
    // إذا ماكانش كويز مختار: نعرض حالة التحكم العامة
    if (!selectedQuizId) return control?.status || "none";

    // إذا المختار هو النشط: نعتمد على quiz_control.status
    if (isSelectedActive) return control?.status || "none";

    // إذا المختار مختلف عن النشط: نعتمد على quizzes.status (draft/finished)
    const qs = selectedQuiz?.status || "draft";
    if (qs === "finished") return "finished";
    return "none"; // draft => none
  }, [selectedQuizId, isSelectedActive, control?.status, selectedQuiz?.status]);

  const statusBadge = useMemo(() => {
    const s = uiStatus;

    if (s === "live") return { text: "LIVE", cls: "bg-rose-100 text-rose-700 border-rose-200" };
    if (s === "scheduled")
      return { text: "SCHEDULED", cls: "bg-amber-100 text-amber-700 border-amber-200" };
    if (s === "finished")
      return { text: "FINISHED", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" };

    // إذا الكويز مختلف و status في DB = draft نبيّنها DRAFT بدل NONE (أوضح)
    if (selectedQuizId && !isSelectedActive && (selectedQuiz?.status || "draft") === "draft") {
      return { text: "DRAFT", cls: "bg-slate-100 text-slate-700 border-slate-200" };
    }

    return { text: "NONE", cls: "bg-slate-100 text-slate-700 border-slate-200" };
  }, [uiStatus, selectedQuizId, isSelectedActive, selectedQuiz?.status]);

  async function load() {
    setMsg("");
    const [{ data: qz, error: qErr }, { data: ctrl, error: cErr }] = await Promise.all([
      // ✅ نجيب status تاع كل كويز
      supabase.from("quizzes").select("id, title, status").order("created_at", { ascending: false }),
      supabase.from("quiz_control").select("*").eq("id", 1).single(),
    ]);

    if (qErr) setMsg(qErr.message);
    if (cErr) setMsg(cErr.message);

    setQuizzes(qz || []);
    setControl(ctrl || null);

    // إذا ماعندكش اختيار سابق، نخلي selected على active_quiz_id (إن وجد)
    setSelectedQuizId((prev) => prev || ctrl?.active_quiz_id || "");
  }

  useEffect(() => {
    load();

    // ✅ realtime على quiz_control فقط
    const channel = supabase
      .channel("admin-quiz-control")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quiz_control", filter: "id=eq.1" },
        (payload) => {
          setControl(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function updateControl(values) {
    setLoading(true);
    setMsg("");
    try {
      const { error } = await supabase.from("quiz_control").update(values).eq("id", 1);
      if (error) throw error;

      // نعيد تحميل الكويزات لأن status قد يتغير
      await load();
    } catch (e) {
      setMsg(e.message || "Update failed");
    } finally {
      setLoading(false);
    }
  }

  async function onGoLive() {
    if (!selectedQuizId) {
      setMsg("اختر كويز أولاً.");
      return;
    }

    setLoading(true);
    setMsg("");
    try {
      const { data, error } = await supabase.rpc("server_time");
      if (error) throw error;

      const serverNow = parseServerTime(data);
      if (!serverNow || Number.isNaN(serverNow.getTime())) {
        throw new Error("لم أستطع قراءة وقت السيرفر من server_time()");
      }

      const startsAt = new Date(serverNow.getTime() + 5000).toISOString();

      await updateControl({
        active_quiz_id: selectedQuizId,
        status: "live",
        starts_at: startsAt,
      });
      await apiFetch("/api/admin/quiz-control/seed-lifelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_id: selectedQuizId }),
      });
    } catch (e) {
      setMsg(e.message || "Go live failed");
      setLoading(false);
    }
  }

  async function onSchedule() {
    if (!selectedQuizId) {
      setMsg("اختر كويز أولاً.");
      return;
    }
    if (!scheduledLocal) {
      setMsg("اختر تاريخ ووقت الجدولة.");
      return;
    }

    setLoading(true);
    setMsg("");
    try {
      const chosen = new Date(scheduledLocal);
      if (Number.isNaN(chosen.getTime())) throw new Error("التاريخ غير صالح.");

      const startsAt = new Date(chosen.getTime() - 60 * 60 * 1000).toISOString();

      await updateControl({
        active_quiz_id: selectedQuizId,
        status: "scheduled",
        starts_at: startsAt,
      });
      await apiFetch("/api/admin/quiz-control/seed-lifelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_id: selectedQuizId }),
      });
    } catch (e) {
      setMsg(e.message || "Schedule failed");
      setLoading(false);
    }
  }

  async function onStop() {
    // Stop منطقي فقط للكويز النشط
    if (!isSelectedActive) {
      setMsg("لا يمكنك إيقاف كويز غير نشط. اختر الكويز النشط أولاً.");
      return;
    }

    setLoading(true);
    setMsg("");
    try {
      await updateControl({ status: "none", starts_at: null });
    } catch (e) {
      setMsg(e.message || "Stop failed");
      setLoading(false);
    }
  }

  // ✅ NEW: Finish button (يجعل الكويز منتهي من هنا)
  async function onFinish() {
    if (!selectedQuizId) {
      setMsg("اختر كويز أولاً.");
      return;
    }

    // منطقيًا الأفضل: نخلي Finish للكويز النشط فقط
    if (!isSelectedActive) {
      setMsg("Finish يعمل فقط للكويز النشط. اختر الكويز النشط أولاً.");
      return;
    }

    if (!confirm("هل تريد جعل هذا الكويز منتهي (FINISHED) الآن؟")) return;

    setLoading(true);
    setMsg("");
    try {
      await apiFetch("/api/admin/quiz-control/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_id: selectedQuizId }),
      });

      await load();
      setSelectedQuizId(selectedQuizId);
    } catch (e) {
      setMsg(e.message || "Finish failed");
    } finally {
      setLoading(false);
    }
  }

  async function onReset() {
    const quizId = selectedQuizId || control?.active_quiz_id;
    if (!quizId) {
      setMsg("لا يوجد كويز لإعادة التصفير.");
      return;
    }

    if (!confirm("Reset سيحذف كل إجابات/نقاط/مشاركين لهذا الكويز. متأكد؟")) return;

    setLoading(true);
    setMsg("");
    try {
      await apiFetch("/api/admin/quiz-control/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_id: quizId }),
      });

      await load();
      setSelectedQuizId(quizId);
    } catch (e) {
      setMsg(e.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminLayout title="Quiz Control" subtitle="تشغيل/جدولة/إيقاف الكويز مع مزامنة وقت Supabase">
      <div className="grid gap-4 max-w-2xl">
        {msg && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
            {msg}
          </div>
        )}

        <Card>
          <CardBody className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-slate-500">Current status</div>
                <div
                  className={`inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full border text-xs font-semibold ${statusBadge.cls}`}
                >
                  {statusBadge.text}
                </div>

                {selectedQuizId && (
                  <div className="text-xs text-slate-500 mt-2">
                    {isSelectedActive ? "هذا هو الكويز النشط حالياً." : "هذا كويز غير نشط حالياً."}
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-500">
                starts_at:{" "}
                <span className="font-mono">
                  {isSelectedActive && control?.starts_at ? new Date(control.starts_at).toLocaleString() : "—"}
                </span>
              </div>
            </div>

            <Select label="Active Quiz" value={selectedQuizId} onChange={(e) => setSelectedQuizId(e.target.value)}>
              <option value="">-- Select Quiz --</option>
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                  {q.status === "finished" ? " ✅" : ""}
                  {q.id === control?.active_quiz_id ? " (active)" : ""}
                </option>
              ))}
            </Select>

            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Schedule time (local)"
                type="datetime-local"
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
              />

              <div className="grid content-end">
                <div className="text-xs text-slate-500">* عند Schedule: نحفظ في Supabase (الوقت المختار - ساعة)</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {uiStatus === "finished" ? (
                <Button variant="soft" disabled={loading} onClick={onReset}>
                  ♻️ Reset (delete quiz data)
                </Button>
              ) : (
                <>
                  <Button variant="danger" disabled={loading} onClick={onGoLive}>
                    🔴 Go Live (server + 5s)
                  </Button>

                  <Button variant="warning" disabled={loading} onClick={onSchedule}>
                    ⏳ Scheduled
                  </Button>

                  {isSelectedActive && (
                    <>
                      <Button variant="soft" disabled={loading} onClick={onStop}>
                        ⛔ Stop
                      </Button>

                      {/* ✅ NEW: Finished */}
                      <Button variant="soft" disabled={loading} onClick={onFinish}>
                        ✅ Finished
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  );
}