import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import AdminLayout from "./AdminLayout";
import { Card, CardBody, Button, Select, Input } from "../../components/ui.jsx";

function parseServerTime(data) {
  // server_time() قد ترجع string أو object أو array حسب تعريفها
  if (!data) return null;

  if (typeof data === "string") return new Date(data);

  if (Array.isArray(data)) {
    // أحيانًا ترجع [{ now: "..." }] أو [{ server_time: "..." }]
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
  const [quizzes, setQuizzes] = useState([]);
  const [control, setControl] = useState(null);

  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState(""); // datetime-local
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const statusBadge = useMemo(() => {
    const s = control?.status;
    if (s === "live") return { text: "LIVE", cls: "bg-rose-100 text-rose-700 border-rose-200" };
    if (s === "scheduled") return { text: "SCHEDULED", cls: "bg-amber-100 text-amber-700 border-amber-200" };
    return { text: "NONE", cls: "bg-slate-100 text-slate-700 border-slate-200" };
  }, [control?.status]);

  async function load() {
    setMsg("");
    const [{ data: qz, error: qErr }, { data: ctrl, error: cErr }] = await Promise.all([
      supabase.from("quizzes").select("id, title").order("created_at", { ascending: false }),
      supabase.from("quiz_control").select("*").eq("id", 1).single(),
    ]);

    if (qErr) setMsg(qErr.message);
    if (cErr) setMsg(cErr.message);

    setQuizzes(qz || []);
    setControl(ctrl || null);
    setSelectedQuizId(ctrl?.active_quiz_id || "");
  }

  useEffect(() => {
    load();

    // تحديث مباشر لو تغيّر quiz_control
    const channel = supabase
      .channel("admin-quiz-control")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quiz_control", filter: "id=eq.1" },
        (payload) => {
          setControl(payload.new);
          setSelectedQuizId(payload.new?.active_quiz_id || "");
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
      // load() مش ضروري بسبب realtime، لكن نخليه احتياط
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
      // ✅ وقت supabase (مش وقت الجهاز)
      const { data, error } = await supabase.rpc("server_time");
      if (error) throw error;

      const serverNow = parseServerTime(data);
      if (!serverNow || Number.isNaN(serverNow.getTime())) {
        throw new Error("لم أستطع قراءة وقت السيرفر من server_time()");
      }

      // ✅ + 5 ثواني
      const startsAt = new Date(serverNow.getTime() + 5000).toISOString();

      await updateControl({
        active_quiz_id: selectedQuizId,
        status: "live",
        starts_at: startsAt,
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
      // datetime-local يعطي وقت محلي (بدون timezone)
      const chosen = new Date(scheduledLocal);
      if (Number.isNaN(chosen.getTime())) throw new Error("التاريخ غير صالح.");

      // ✅ ينقص ساعة قبل ما نرسل للسوبابيز
      const startsAt = new Date(chosen.getTime() - 60 * 60 * 1000).toISOString();

      await updateControl({
        active_quiz_id: selectedQuizId,
        status: "scheduled",
        starts_at: startsAt,
      });
    } catch (e) {
      setMsg(e.message || "Schedule failed");
      setLoading(false);
    }
  }

  async function onStop() {
    setLoading(true);
    setMsg("");
    try {
      await updateControl({ status: "none" });
    } catch (e) {
      setMsg(e.message || "Stop failed");
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
                <div className={`inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full border text-xs font-semibold ${statusBadge.cls}`}>
                  {statusBadge.text}
                </div>
              </div>
              <div className="text-xs text-slate-500">
                starts_at:{" "}
                <span className="font-mono">
                  {control?.starts_at ? new Date(control.starts_at).toLocaleString() : "—"}
                </span>
              </div>
            </div>

            <Select
              label="Active Quiz"
              value={selectedQuizId}
              onChange={(e) => setSelectedQuizId(e.target.value)}
            >
              <option value="">-- Select Quiz --</option>
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
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
                <div className="text-xs text-slate-500">
                  * عند Schedule: نحفظ في Supabase (الوقت المختار - ساعة)
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="danger" disabled={loading} onClick={onGoLive}>
                🔴 Go Live (server + 5s)
              </Button>

              <Button variant="warning" disabled={loading} onClick={onSchedule}>
                ⏳ Scheduled
              </Button>

              <Button variant="soft" disabled={loading} onClick={onStop}>
                ⛔ Stop
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  );
}