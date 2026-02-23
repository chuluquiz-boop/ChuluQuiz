import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import AdminLayout from "./AdminLayout";
import { apiFetch } from "../../lib/api"; 
import { Card, CardBody, Button, Select, Input } from "../../components/ui.jsx";

const LABELS = ["A", "B", "C", "D"];

function emptyQuestion(defaultLevelId = "") {
    return {
        level_id: defaultLevelId || "",
        question_text: "",
        hint: "",
        choices: LABELS.map((l) => ({ label: l, choice_text: "" })),
        correctLabel: "A",
    };
}

export default function CreateQuiz() {
    const [levels, setLevels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const [okMsg, setOkMsg] = useState("");

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");

    const defaultLevelId = useMemo(() => (levels?.[0]?.id ? String(levels[0].id) : ""), [levels]);
    const [questions, setQuestions] = useState([emptyQuestion("")]);

    useEffect(() => {
        (async () => {
            setMsg("");
            const { data, error } = await supabase
                .from("levels")
                .select("id, name, points, order_index")
                .order("order_index", { ascending: true });

            if (error) {
                setMsg(error.message);
                setLevels([]);
                return;
            }
            setLevels(data || []);
        })();
    }, []);

    // لما تجينا levels لأول مرة، نملأ level_id الافتراضي في الأسئلة الفارغة
    useEffect(() => {
        if (!defaultLevelId) return;
        setQuestions((prev) =>
            prev.map((q) => (q.level_id ? q : { ...q, level_id: defaultLevelId }))
        );
    }, [defaultLevelId]);

    function setQ(idx, patch) {
        setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
    }

    function setChoice(qIdx, cIdx, value) {
        setQuestions((prev) =>
            prev.map((q, i) => {
                if (i !== qIdx) return q;
                const choices = q.choices.map((c, j) => (j === cIdx ? { ...c, choice_text: value } : c));
                return { ...q, choices };
            })
        );
    }

    function addQuestion() {
        setQuestions((prev) => [...prev, emptyQuestion(defaultLevelId)]);
    }

    function removeQuestion(idx) {
        setQuestions((prev) => prev.filter((_, i) => i !== idx));
    }

    function validate() {
        const t = title.trim();
        if (t.length < 2) return "اسم الكويز (Title) لازم يكون على الأقل حرفين.";

        if (!questions.length) return "لازم تضيف سؤال واحد على الأقل.";

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.level_id) return `السؤال رقم ${i + 1}: لازم تختار Level.`;
            if (!q.question_text.trim()) return `السؤال رقم ${i + 1}: اكتب نص السؤال.`;

            const filled = q.choices.filter((c) => c.choice_text.trim().length > 0);
            if (filled.length < 2) return `السؤال رقم ${i + 1}: لازم تكتب على الأقل اقتراحين.`;

            const corr = q.correctLabel;
            const corrChoice = q.choices.find((c) => c.label === corr);
            if (!corrChoice || !corrChoice.choice_text.trim()) {
                return `السؤال رقم ${i + 1}: اختر "Correct" على خيار مكتوب (غير فارغ).`;
            }
        }
        return "";
    }

    async function onSave() {
        setMsg("");
        setOkMsg("");

        const v = validate();
        if (v) {
            setMsg(v);
            return;
        }

        setLoading(true);
        try {
            const payload = {
                title: title.trim(),
                description: description.trim() ? description.trim() : null,
                questions: questions.map((q) => ({
                    level_id: Number(q.level_id),
                    question_text: q.question_text.trim(),
                    hint: q.hint.trim() ? q.hint.trim() : null,
                    choices: q.choices
                        .filter((c) => c.choice_text.trim().length > 0)
                        .map((c) => ({
                            label: c.label,
                            choice_text: c.choice_text.trim(),
                            is_correct: c.label === q.correctLabel,
                        })),
                })),
            };

            const json = await apiFetch("/api/admin/create-quiz", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            setOkMsg("✅ تم إنشاء الكويز بنجاح (Draft).");
            setTitle("");
            setDescription("");
            setQuestions([emptyQuestion(defaultLevelId)]);
        } catch (e) {
            setMsg(e?.message || "فشل إنشاء الكويز.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <AdminLayout
            title="Create Quiz"
            subtitle="إنشاء كويز جديد + أسئلة + اقتراحات + الإجابة الصحيحة + التلميح"
        >
            <div className="grid gap-4 max-w-4xl">
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
                        <Input label="Quiz Title" value={title} onChange={(e) => setTitle(e.target.value)} />
                        <div className="grid gap-2">
                            <div className="text-sm font-medium text-slate-700">Description (اختياري)</div>
                            <textarea
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                                rows={3}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="وصف بسيط للكويز..."
                            />
                        </div>
                    </CardBody>
                </Card>

                <div className="flex items-center justify-between">
                    <div className="text-slate-700 font-semibold">
                        Questions <span className="text-slate-400 font-normal">({questions.length})</span>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="soft" onClick={addQuestion} disabled={loading}>
                            ➕ Add Question
                        </Button>
                        <Button variant="primary" onClick={onSave} disabled={loading}>
                            💾 Save Quiz (Draft)
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4">
                    {questions.map((q, idx) => (
                        <Card key={idx}>
                            <CardBody className="grid gap-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="font-semibold text-slate-800">Q{idx + 1}</div>
                                    <Button
                                        variant="danger"
                                        onClick={() => removeQuestion(idx)}
                                        disabled={loading || questions.length <= 1}
                                    >
                                        🗑️ Remove
                                    </Button>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-4">
                                    <Select
                                        label="Level"
                                        value={q.level_id}
                                        onChange={(e) => setQ(idx, { level_id: e.target.value })}
                                    >
                                        <option value="">-- Select Level --</option>
                                        {levels.map((lv) => (
                                            <option key={lv.id} value={String(lv.id)}>
                                                {lv.name} (points: {lv.points})
                                            </option>
                                        ))}
                                    </Select>

                                    <Select
                                        label="Correct"
                                        value={q.correctLabel}
                                        onChange={(e) => setQ(idx, { correctLabel: e.target.value })}
                                    >
                                        {LABELS.map((l) => (
                                            <option key={l} value={l}>
                                                {l}
                                            </option>
                                        ))}
                                    </Select>
                                </div>

                                <div className="grid gap-2">
                                    <div className="text-sm font-medium text-slate-700">Question Text</div>
                                    <textarea
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                                        rows={3}
                                        value={q.question_text}
                                        onChange={(e) => setQ(idx, { question_text: e.target.value })}
                                        placeholder="اكتب السؤال هنا..."
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <div className="text-sm font-medium text-slate-700">Hint (اختياري)</div>
                                    <textarea
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                                        rows={2}
                                        value={q.hint}
                                        onChange={(e) => setQ(idx, { hint: e.target.value })}
                                        placeholder="تلميح يساعد اللاعب..."
                                    />
                                </div>

                                <div className="grid gap-3">
                                    <div className="text-sm font-medium text-slate-700">Choices</div>

                                    <div className="grid sm:grid-cols-2 gap-3">
                                        {q.choices.map((c, cIdx) => {
                                            const isCorrect = q.correctLabel === c.label;
                                            return (
                                                <div key={c.label} className="rounded-xl border border-slate-200 p-3">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="text-xs font-semibold text-slate-600">
                                                            {c.label} {isCorrect ? "✅ (Correct)" : ""}
                                                        </div>
                                                    </div>
                                                    <input
                                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                                                        value={c.choice_text}
                                                        onChange={(e) => setChoice(idx, cIdx, e.target.value)}
                                                        placeholder={`Choice ${c.label}...`}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="text-xs text-slate-500">
                                        * اترك الخيار فارغًا إذا لا تريده (لكن لازم على الأقل خيارين مكتوبين).
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="primary" onClick={onSave} disabled={loading}>
                        💾 Save Quiz (Draft)
                    </Button>
                </div>
            </div>
        </AdminLayout>
    );
}