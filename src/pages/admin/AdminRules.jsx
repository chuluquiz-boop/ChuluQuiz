import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { Card, CardBody, Button, Select, Input } from "../../components/ui.jsx";
import { apiFetch } from "../../lib/api";

function isSameQuiz(a, b) {
  const A = a == null ? "null" : String(a);
  const B = b == null ? "null" : String(b);
  return A === B;
}

export default function AdminRules() {
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState("null"); // "null" => general rules

  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState([]);

  // selected rule id in list
  const [selectedRuleId, setSelectedRuleId] = useState("");

  // editor
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  // copy
  const [copyRuleId, setCopyRuleId] = useState("");
  const [copyToQuiz, setCopyToQuiz] = useState("");
  const [overwrite, setOverwrite] = useState(false); // هنا overwrite يعني: يحذف قواعد الهدف قبل النسخ

  const selectedRule = useMemo(() => {
    return rules.find((r) => r.id === selectedRuleId) || null;
  }, [rules, selectedRuleId]);

  async function loadQuizzes() {
    const r = await apiFetch("/api/admin/quizzes");
    setQuizzes(r?.quizzes || []);
  }

  async function loadRules(qid) {
    setLoading(true);
    try {
      const url = qid
        ? `/api/admin/rules?quiz_id=${encodeURIComponent(qid)}`
        : "/api/admin/rules";

      const r = await apiFetch(url);
      const arr = Array.isArray(r?.rules) ? r.rules : [];

      setRules(arr);

      // auto select first rule
      const first = arr[0] || null;
      setSelectedRuleId(first?.id || "");
      setCopyRuleId(first?.id || "");

      setTitle(first?.title || "");
      setContent(first?.content || "");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuizzes().catch(() => {});
  }, []);

  useEffect(() => {
    loadRules(selectedQuizId).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuizId]);

  function startNewRule() {
    setSelectedRuleId(""); // new mode
    setTitle("");
    setContent("");
  }

  function selectRule(id) {
    setSelectedRuleId(id);
    const r = rules.find((x) => x.id === id);
    setTitle(r?.title || "");
    setContent(r?.content || "");
  }

  async function saveRule() {
    if (!content.trim()) {
      alert("اكتب محتوى القواعد");
      return;
    }

    const quiz_id = selectedQuizId === "null" ? null : selectedQuizId;

    // update
    if (selectedRuleId) {
      const r = await apiFetch(`/api/admin/rules/${selectedRuleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quiz_id,
          title: title || null,
          content,
        }),
      });

      alert("تم حفظ التعديل ✅");

      const updated = r?.rule || null;
      if (updated) {
        setRules((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      }
      return;
    }

    // create
    const created = await apiFetch("/api/admin/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quiz_id,
        title: title || null,
        content,
      }),
    });

    const newRule = created?.rule || null;
    if (!newRule) return;

    alert("تمت الإضافة ✅");

    // prepend newest
    setRules((prev) => [newRule, ...prev]);
    setSelectedRuleId(newRule.id);
    setCopyRuleId(newRule.id);
  }

  async function deleteRule() {
    if (!selectedRuleId) return;

    const ok = window.confirm("أكيد تحب تحذف هذه القاعدة؟");
    if (!ok) return;

    await apiFetch(`/api/admin/rules/${selectedRuleId}`, { method: "DELETE" });

    alert("تم الحذف ✅");

    setRules((prev) => prev.filter((x) => x.id !== selectedRuleId));

    // select next
    const remaining = rules.filter((x) => x.id !== selectedRuleId);
    const next = remaining[0] || null;
    setSelectedRuleId(next?.id || "");
    setCopyRuleId(next?.id || "");
    setTitle(next?.title || "");
    setContent(next?.content || "");
  }

  async function doCopySelectedRule() {
    if (!copyRuleId) {
      alert("اختار القاعدة لي تحب تنسخها");
      return;
    }
    if (!copyToQuiz) {
      alert("اختار كويز الهدف");
      return;
    }

    // إذا overwrite: نحذف كل قواعد الهدف قبل النسخ
    if (overwrite) {
      const targetQuizId = copyToQuiz === "null" ? "null" : copyToQuiz;
      const targetRules = await apiFetch(`/api/admin/rules?quiz_id=${encodeURIComponent(targetQuizId)}`);
      const ids = (targetRules?.rules || []).map((x) => x.id);

      for (const id of ids) {
        try {
          await apiFetch(`/api/admin/rules/${id}`, { method: "DELETE" });
        } catch {}
      }
    }

    // نجيب القاعدة المصدر من rules الحالية
    const src = rules.find((x) => x.id === copyRuleId);
    if (!src) {
      alert("لم يتم العثور على القاعدة المصدر");
      return;
    }

    const payload = {
      quiz_id: copyToQuiz === "null" ? null : copyToQuiz,
      title: src.title || null,
      content: src.content,
    };

    const created = await apiFetch("/api/admin/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    alert("تم النسخ ✅");

    // إذا الهدف هو نفس صفحة العرض الحالية => نعاودو التحميل كي تظهر
    const cur = selectedQuizId;
    const tgt = copyToQuiz;
    if (cur === tgt) {
      loadRules(selectedQuizId).catch(() => {});
    }
  }

  const selectedQuizName = useMemo(() => {
    if (selectedQuizId === "null") return "قواعد عامة";
    const q = quizzes.find((x) => String(x.id) === String(selectedQuizId));
    return q?.title || "كويز";
  }, [selectedQuizId, quizzes]);

  return (
    <AdminLayout title="Rules" subtitle="إضافة/تعديل/حذف/نسخ قواعد المسابقة حسب الكويز">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: quiz selector + list + copy */}
        <Card className="lg:col-span-1">
          <CardBody>
            <div className="font-bold mb-2">اختيار الكويز</div>

            <Select value={selectedQuizId} onChange={(e) => setSelectedQuizId(e.target.value)}>
              <option value="null">قواعد عامة (بدون كويز)</option>
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </Select>

            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={startNewRule}>
                + قاعدة جديدة
              </Button>
            </div>

            <div className="mt-4 border-t pt-4">
              <div className="font-bold mb-2">كل القواعد ({rules.length})</div>

              {loading ? (
                <div className="text-sm text-slate-600">جاري التحميل...</div>
              ) : rules.length === 0 ? (
                <div className="text-sm text-slate-600">لا توجد قواعد هنا بعد.</div>
              ) : (
                <div className="max-h-[320px] overflow-auto grid gap-2">
                  {rules.map((r) => {
                    const active = r.id === selectedRuleId;
                    return (
                      <button
                        key={r.id}
                        onClick={() => selectRule(r.id)}
                        className={[
                          "w-full text-right rounded-xl border px-3 py-2 transition",
                          active ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50",
                        ].join(" ")}
                        type="button"
                      >
                        <div className="font-semibold truncate">
                          {r.title ? r.title : "(بدون عنوان)"}
                        </div>
                        <div className={`text-xs mt-1 ${active ? "text-white/80" : "text-slate-500"}`}>
                          {r.updated_at ? new Date(r.updated_at).toLocaleString() : ""}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 border-t pt-4">
              <div className="font-bold mb-2">نسخ قاعدة إلى كويز آخر</div>

              <div className="text-sm text-slate-600 mb-2">اختر القاعدة:</div>
              <Select value={copyRuleId} onChange={(e) => setCopyRuleId(e.target.value)}>
                <option value="">-- اختر قاعدة --</option>
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title ? r.title : "(بدون عنوان)"} — {r.updated_at ? new Date(r.updated_at).toLocaleDateString() : ""}
                  </option>
                ))}
              </Select>

              <div className="text-sm text-slate-600 mt-3 mb-2">إلى:</div>
              <Select value={copyToQuiz} onChange={(e) => setCopyToQuiz(e.target.value)}>
                <option value="">-- اختر الهدف --</option>
                <option value="null">قواعد عامة</option>
                {quizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title}
                  </option>
                ))}
              </Select>

              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                overwrite (يحذف قواعد الهدف قبل النسخ)
              </label>

              <Button className="mt-3 w-full" onClick={doCopySelectedRule}>
                نسخ القاعدة
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Right: editor */}
        <Card className="lg:col-span-2">
          <CardBody>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="font-bold">محرّر القواعد — {selectedQuizName}</div>
              <div className="text-sm text-slate-600">
                {selectedRuleId ? "تعديل قاعدة" : "إضافة قاعدة جديدة"}
              </div>
            </div>

            <div className="grid gap-3">
              <div>
                <div className="text-sm text-slate-600 mb-1">عنوان (اختياري)</div>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: خصم النقاط عند عدم الإجابة" />
              </div>

              <div>
                <div className="text-sm text-slate-600 mb-1">المحتوى</div>
                <textarea
                  className="w-full min-h-[260px] rounded-xl border p-3 outline-none focus:ring-2 focus:ring-slate-300"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="اكتب القواعد هنا..."
                  dir="rtl"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={saveRule} className="flex-1">
                  حفظ
                </Button>

                <Button
                  onClick={deleteRule}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={!selectedRuleId}
                >
                  حذف
                </Button>
              </div>

              {selectedRule?.updated_at ? (
                <div className="text-xs text-slate-500">
                  آخر تحديث: {new Date(selectedRule.updated_at).toLocaleString()}
                </div>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  );
}