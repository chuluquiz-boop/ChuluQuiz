import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import AdminLayout from "./AdminLayout";
import { Card, CardBody, Button, Select, Input } from "../../components/ui.jsx";
import { apiFetch } from "../../lib/api";

const LABELS = ["A", "B", "C", "D"];

function normalizeChoices(arr = []) {
  // نضمن A/B/C/D موجودين دائماً
  const map = new Map((arr || []).map((c) => [String(c.label || "").toUpperCase(), c]));
  return LABELS.map((l) => {
    const c = map.get(l) || {};
    return {
      id: c.id || null,
      label: l,
      choice_text: c.choice_text || "",
      is_correct: !!c.is_correct,
    };
  });
}

export default function ManageQuiz() {
  const [msg, setMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const [quizzes, setQuizzes] = useState([]);
  const [quizId, setQuizId] = useState("");

  const [levels, setLevels] = useState([]);

  const [meta, setMeta] = useState({ title: "", description: "", seconds_per_question: 3 });
  const [questions, setQuestions] = useState([]);

  // Load quizzes list
  useEffect(() => {
    (async () => {
      setMsg("");
      setOkMsg("");
      try {
        const json = await apiFetch("/api/admin/quizzes");
        if (!json?.ok) throw new Error(json?.message || "فشل تحميل قائمة الكويزات");
        setQuizzes(json.quizzes || []);
      } catch (e) {
        setMsg(e?.message || "فشل تحميل قائمة الكويزات");
        setQuizzes([]);
      }
    })();
  }, []);

  // Load levels (direct Supabase)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("levels")
        .select("id, name, points, order_index")
        .order("order_index", { ascending: true });

      if (error) {
        setLevels([]);
        return;
      }
      setLevels(data || []);
    })();
  }, []);

  const quizOptions = useMemo(() => quizzes || [], [quizzes]);

  async function loadFull(id) {
    setMsg("");
    setOkMsg("");
    setLoading(true);
    try {
      const json = await apiFetch(`/api/admin/quizzes/${id}/full`);
      if (!json?.ok) throw new Error(json?.message || "فشل تحميل تفاصيل الكويز");

      const q = json.quiz;
      setMeta({
        title: q?.title || "",
        description: q?.description || "",
        seconds_per_question: json?.settings?.seconds_per_question ?? 3,
      });

      const qs = (json.questions || []).map((x) => ({
        id: x.id,
        quiz_id: x.quiz_id,
        level_id: String(x.level_id || ""),
        question_text: x.question_text || "",
        hint: x.hint || "",
        choices: normalizeChoices(x.choices || []),
      }));
      setQuestions(qs);
    } catch (e) {
      setMsg(e?.message || "خطأ غير معروف");
      setMeta({ title: "", description: "", seconds_per_question: 3 });
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  function setQ(qid, patch) {
    setQuestions((prev) => prev.map((q) => (q.id === qid ? { ...q, ...patch } : q)));
  }

  function setChoice(qid, label, patch) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qid) return q;
        const choices = q.choices.map((c) => (c.label === label ? { ...c, ...patch } : c));
        return { ...q, choices };
      })
    );
  }

  function markCorrect(qid, label) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qid) return q;
        const choices = q.choices.map((c) => ({ ...c, is_correct: c.label === label }));
        return { ...q, choices };
      })
    );
  }

  async function saveMeta() {
    setMsg("");
    setOkMsg("");
    if (!quizId) return;

    const t = meta.title.trim();
    if (t.length < 2) {
      setMsg("Title لازم يكون على الأقل حرفين.");
      return;
    }

    const s = Number(meta.seconds_per_question);
    if (!Number.isFinite(s) || s < 1 || s > 300) {
      setMsg("وقت السؤال لازم بين 1 و 300 ثانية.");
      return;
    }

    setLoading(true);
    try {
      const json = await apiFetch(`/api/admin/quizzes/${quizId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          description: meta.description?.trim() ? meta.description.trim() : null,
          seconds_per_question: Math.floor(s),
        }),
      });

      if (!json?.ok) throw new Error(json?.message || "فشل حفظ معلومات الكويز");

      setOkMsg("✅ تم حفظ معلومات الكويز.");
      // تحديث قائمة الكويزات في sidebar/select
      setQuizzes((prev) => prev.map((x) => (x.id === quizId ? { ...x, title: t } : x)));
    } catch (e) {
      setMsg(e?.message || "فشل حفظ معلومات الكويز.");
    } finally {
      setLoading(false);
    }
  }

  async function saveQuestion(q) {
    setMsg("");
    setOkMsg("");

    const qt = q.question_text.trim();
    if (!qt) return setMsg("نص السؤال فارغ.");

    const filled = q.choices.filter((c) => String(c.choice_text || "").trim());
    if (filled.length < 2) return setMsg("لازم على الأقل اقتراحين مكتوبين.");
    const correctCount = filled.filter((c) => c.is_correct).length;
    if (correctCount !== 1) return setMsg("لازم جواب صحيح واحد فقط.");

    setLoading(true);
    try {
      // 1) update question
      const j1 = await apiFetch(`/api/admin/questions/${q.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level_id: Number(q.level_id),
          question_text: qt,
          hint: q.hint?.trim() ? q.hint.trim() : null,
        }),
      });

      if (!j1?.ok) throw new Error(j1?.message || "فشل تحديث السؤال");

      // 2) choices (replace/update without delete on backend)
      const j2 = await apiFetch(`/api/admin/questions/${q.id}/choices`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          choices: q.choices.map((c) => ({
            id: c.id, // ✅ مهم
            label: c.label,
            choice_text: c.choice_text,
            is_correct: c.is_correct,
          })),
        }),
      });

      if (!j2?.ok) throw new Error(j2?.message || "فشل تحديث الاقتراحات");

      setOkMsg("✅ تم حفظ السؤال.");
    } catch (e) {
      setMsg(e?.message || "فشل حفظ السؤال.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteQuestion(qid) {
    setMsg("");
    setOkMsg("");
    setLoading(true);
    try {
      const json = await apiFetch(`/api/admin/questions/${qid}`, { method: "DELETE" });
      if (!json?.ok) throw new Error(json?.message || "فشل حذف السؤال");
      setQuestions((prev) => prev.filter((q) => q.id !== qid));
      setOkMsg("🗑️ تم حذف السؤال.");
    } catch (e) {
      setMsg(e?.message || "فشل حذف السؤال.");
    } finally {
      setLoading(false);
    }
  }

  async function moveQuestion(qid, toQuizId) {
    setMsg("");
    setOkMsg("");
    if (!toQuizId) return;

    setLoading(true);
    try {
      const json = await apiFetch(`/api/admin/questions/${qid}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_quiz_id: toQuizId }),
      });

      if (!json?.ok) throw new Error(json?.message || "فشل نقل السؤال");

      // نحذف السؤال من اللائحة لأنو راح لكويز آخر
      setQuestions((prev) => prev.filter((q) => q.id !== qid));
      setOkMsg("✅ تم نقل السؤال.");
    } catch (e) {
      setMsg(e?.message || "فشل نقل السؤال.");
    } finally {
      setLoading(false);
    }
  }

  async function addQuestion() {
    setMsg("");
    setOkMsg("");
    if (!quizId) return;

    const defaultLevel = levels?.[0]?.id ? String(levels[0].id) : "";
    if (!defaultLevel) return setMsg("لا يوجد Levels.");

    setLoading(true);
    try {
      const payload = {
        level_id: Number(defaultLevel),
        question_text: "سؤال جديد...",
        hint: null,
        choices: LABELS.map((l) => ({
          label: l,
          choice_text: l === "A" ? "اقتراح 1" : l === "B" ? "اقتراح 2" : "",
          is_correct: l === "A",
        })),
      };

      const json = await apiFetch(`/api/admin/quizzes/${quizId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!json?.ok) throw new Error(json?.message || "فشل إضافة السؤال");

      // Reload full to get full row + ordering
      await loadFull(quizId);
      setOkMsg("➕ تم إضافة سؤال جديد.");
    } catch (e) {
      setMsg(e?.message || "فشل إضافة السؤال.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminLayout
      title="Manage Quiz"
      subtitle="تعديل الكويزات: الاسم/الوصف/وقت السؤال + إدارة الأسئلة والاقتراحات + نقل الأسئلة"
    >
      <div className="grid gap-4 max-w-5xl">
        {msg && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
            {msg}
          </div>
        )}
        {okMsg && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            {okMsg}
          </div>
        )}

        <Card>
          <CardBody className="grid gap-4">
            <Select
              label="اختر الكويز"
              value={quizId}
              onChange={(e) => {
                const id = e.target.value;
                setQuizId(id);
                if (id) loadFull(id);
              }}
            >
              <option value="">-- اختر --</option>
              {quizOptions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title} ({q.status})
                </option>
              ))}
            </Select>

            {quizId && (
              <div className="grid gap-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input
                    label="Quiz Title"
                    value={meta.title}
                    onChange={(e) => setMeta((p) => ({ ...p, title: e.target.value }))}
                  />
                  <Input
                    label="Seconds per question"
                    type="number"
                    min={1}
                    max={300}
                    value={meta.seconds_per_question}
                    onChange={(e) =>
                      setMeta((p) => ({ ...p, seconds_per_question: e.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <div className="text-sm font-medium text-slate-700">Description</div>
                  <textarea
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    rows={3}
                    value={meta.description || ""}
                    onChange={(e) => setMeta((p) => ({ ...p, description: e.target.value }))}
                    placeholder="وصف الكويز..."
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="primary" onClick={saveMeta} disabled={loading}>
                    💾 Save Quiz Info
                  </Button>
                  <Button variant="soft" onClick={addQuestion} disabled={loading}>
                    ➕ Add Question
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {quizId && (
          <div className="grid gap-4">
            <div className="text-slate-800 font-semibold">
              Questions <span className="text-slate-400 font-normal">({questions.length})</span>
            </div>

            {questions.map((q, idx) => (
              <Card key={q.id}>
                <CardBody className="grid gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-800">Q{idx + 1}</div>
                    <div className="flex gap-2">
                      <Button variant="primary" onClick={() => saveQuestion(q)} disabled={loading}>
                        💾 Save
                      </Button>
                      <Button variant="danger" onClick={() => deleteQuestion(q.id)} disabled={loading}>
                        🗑️ Delete
                      </Button>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Select
                      label="Level"
                      value={q.level_id}
                      onChange={(e) => setQ(q.id, { level_id: e.target.value })}
                    >
                      <option value="">-- Select Level --</option>
                      {levels.map((lv) => (
                        <option key={lv.id} value={String(lv.id)}>
                          {lv.name} (+{lv.points})
                        </option>
                      ))}
                    </Select>

                    <Select
                      label="Move to another quiz"
                      defaultValue=""
                      onChange={(e) => {
                        const to = e.target.value;
                        if (!to) return;
                        if (to === quizId) return;
                        moveQuestion(q.id, to);
                        e.target.value = "";
                      }}
                    >
                      <option value="">-- نقل السؤال إلى --</option>
                      {quizOptions
                        .filter((x) => x.id !== quizId)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.title}
                          </option>
                        ))}
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <div className="text-sm font-medium text-slate-700">Question Text</div>
                    <textarea
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                      rows={2}
                      value={q.question_text}
                      onChange={(e) => setQ(q.id, { question_text: e.target.value })}
                    />
                  </div>

                  <Input
                    label="Hint (اختياري)"
                    value={q.hint || ""}
                    onChange={(e) => setQ(q.id, { hint: e.target.value })}
                  />

                  <div className="grid gap-3">
                    <div className="text-sm font-semibold text-slate-800">Choices</div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      {q.choices.map((c) => (
                        <div
                          key={c.label}
                          className="rounded-xl border border-slate-200 p-3 grid gap-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-slate-700">{c.label}</div>
                            <label className="text-xs flex items-center gap-2 text-slate-600">
                              <input
                                type="radio"
                                name={`correct_${q.id}`}
                                checked={!!c.is_correct}
                                onChange={() => markCorrect(q.id, c.label)}
                              />
                              Correct
                            </label>
                          </div>

                          <input
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                            value={c.choice_text}
                            onChange={(e) =>
                              setChoice(q.id, c.label, { choice_text: e.target.value })
                            }
                            placeholder={`Choice ${c.label}`}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="text-xs text-slate-500">
                      ملاحظة: لازم تكتب على الأقل اقتراحين، ولازم Correct واحد فقط.
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}