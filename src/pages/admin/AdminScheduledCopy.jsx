import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { Card, CardBody, Button, Select, Input } from "../../components/ui.jsx";
import { apiFetch } from "../../lib/api";

const SLOT_OPTIONS = [
  { value: "title", label: "Title (العنوان)" },
  { value: "start_line", label: "Start line (السطر الأحمر)" },
  { value: "body", label: "Body (فقرة)" },
];

export default function AdminScheduledCopy() {
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState("null"); // "null" => general
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  // selected row
  const [selectedId, setSelectedId] = useState("");

  // editor
  const [slot, setSlot] = useState("body");
  const [orderIndex, setOrderIndex] = useState(1);
  const [state, setState] = useState(1);
  const [content, setContent] = useState("");

  // copy
  const [copyToQuiz, setCopyToQuiz] = useState("");
  const [overwrite, setOverwrite] = useState(false);

  const selectedRow = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);

  async function loadQuizzes() {
    const r = await apiFetch("/api/admin/quizzes");
    setQuizzes(r?.quizzes || []);
  }

  async function loadRows(qid) {
    setLoading(true);
    try {
      const url = qid
        ? `/api/admin/scheduled-copy?quiz_id=${encodeURIComponent(qid)}&stat=1`
        : "/api/admin/scheduled-copy?stat=1";

      const r = await apiFetch(url);
      const arr = Array.isArray(r?.rows) ? r.rows : [];

      setRows(arr);

      const first = arr[0] || null;
      setSelectedId(first?.id || "");

      setSlot(first?.slot || "body");
      setOrderIndex(Number.isFinite(Number(first?.order_index)) ? Number(first.order_index) : 0);
      setState(Number.isFinite(Number(first?.state)) ? Number(first.state) : 1);
      setContent(first?.content || "");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuizzes().catch(() => {});
  }, []);

  useEffect(() => {
    loadRows(selectedQuizId).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuizId]);

  function startNew() {
    setSelectedId("");
    setSlot("body");
    setOrderIndex(1);
    setState(1);
    setContent("");
  }

  function selectRow(id) {
    setSelectedId(id);
    const r = rows.find((x) => x.id === id);
    setSlot(r?.slot || "body");
    setOrderIndex(Number.isFinite(Number(r?.order_index)) ? Number(r.order_index) : 0);
    setState(Number.isFinite(Number(r?.state)) ? Number(r.state) : 1);
    setContent(r?.content || "");
  }

  async function save() {
    if (!content.trim()) {
      alert("اكتب النص");
      return;
    }

    const quiz_id = selectedQuizId === "null" ? null : selectedQuizId;

    // update
    if (selectedId) {
      const r = await apiFetch(`/api/admin/scheduled-copy/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quiz_id,
          stat: 1,
          state: Number(state),
          slot,
          order_index: Number(orderIndex),
          content,
        }),
      });

      alert("تم حفظ التعديل ✅");
      const updated = r?.row || null;
      if (updated) setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      return;
    }

    // create
    const created = await apiFetch("/api/admin/scheduled-copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quiz_id,
        stat: 1,
        state: Number(state),
        slot,
        order_index: Number(orderIndex),
        content,
      }),
    });

    const newRow = created?.row || null;
    if (!newRow) return;

    alert("تمت الإضافة ✅");
    setRows((prev) => [newRow, ...prev]);
    setSelectedId(newRow.id);
  }

  async function remove() {
    if (!selectedId) return;
    const ok = window.confirm("أكيد تحب تحذف هذا النص؟");
    if (!ok) return;

    await apiFetch(`/api/admin/scheduled-copy/${selectedId}`, { method: "DELETE" });
    alert("تم الحذف ✅");

    const remaining = rows.filter((x) => x.id !== selectedId);
    setRows(remaining);

    const first = remaining[0] || null;
    setSelectedId(first?.id || "");
    setSlot(first?.slot || "body");
    setOrderIndex(Number.isFinite(Number(first?.order_index)) ? Number(first.order_index) : 0);
    setState(Number.isFinite(Number(first?.state)) ? Number(first.state) : 1);
    setContent(first?.content || "");
  }

  async function copyAll() {
    if (!copyToQuiz) {
      alert("اختار كويز الهدف");
      return;
    }

    const from_quiz_id = selectedQuizId === "null" ? null : selectedQuizId;
    const to_quiz_id = copyToQuiz === "null" ? null : copyToQuiz;

    await apiFetch("/api/admin/scheduled-copy/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_quiz_id,
        to_quiz_id,
        overwrite,
        stat: 1,
      }),
    });

    alert("تم النسخ ✅");

    // إذا الهدف هو نفس الصفحة الحالية نعاودو التحميل
    if (String(copyToQuiz) === String(selectedQuizId)) {
      loadRows(selectedQuizId).catch(() => {});
    }
  }

  return (
    <AdminLayout title="Scheduled Copy" subtitle="إضافة/تعديل/حذف/نسخ نصوص شاشة الكويز المجدول">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left */}
        <Card className="lg:col-span-1">
          <CardBody>
            <div className="text-sm font-semibold mb-2">اختر الكويز</div>

            <Select
              value={selectedQuizId}
              onChange={(e) => setSelectedQuizId(e.target.value)}
              className="w-full"
            >
              <option value="null">نصوص عامة (بدون quiz_id)</option>
              {(quizzes || []).map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title || q.id}
                </option>
              ))}
            </Select>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm font-semibold">النصوص</div>
              <Button onClick={startNew}>+ جديد</Button>
            </div>

            {loading ? (
              <div className="mt-3 text-sm text-slate-500">جاري التحميل...</div>
            ) : (
              <div className="mt-3 grid gap-2">
                {(rows || []).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => selectRow(r.id)}
                    className={[
                      "w-full text-right rounded-xl border px-3 py-2 text-sm transition",
                      r.id === selectedId ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50",
                    ].join(" ")}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{r.slot}</span>
                      <span className="text-xs text-slate-500">#{r.order_index ?? 0}</span>
                    </div>
                    <div className="mt-1 text-slate-700 line-clamp-2">{r.content}</div>
                    <div className="mt-1 text-xs text-slate-500">{Number(r.state) === 1 ? "✅ مفعّل" : "⛔ غير مفعّل"}</div>
                  </button>
                ))}

                {!rows.length ? <div className="text-sm text-slate-500">لا توجد نصوص</div> : null}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-slate-200">
              <div className="text-sm font-semibold mb-2">نسخ كل النصوص</div>
              <Select value={copyToQuiz} onChange={(e) => setCopyToQuiz(e.target.value)} className="w-full">
                <option value="">— اختر الهدف —</option>
                <option value="null">نصوص عامة (بدون quiz_id)</option>
                {(quizzes || []).map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title || q.id}
                  </option>
                ))}
              </Select>

              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                overwrite (يحذف نصوص الهدف قبل النسخ)
              </label>

              <Button className="mt-3 w-full" onClick={copyAll}>
                نسخ الآن ✅
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Right */}
        <Card className="lg:col-span-2">
          <CardBody>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">
                {selectedId ? "تعديل النص" : "إضافة نص جديد"}
              </div>
              <div className="flex gap-2">
                <Button onClick={save}>حفظ</Button>
                <Button onClick={remove} disabled={!selectedId}>
                  حذف
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">slot</div>
                <Select value={slot} onChange={(e) => setSlot(e.target.value)} className="w-full">
                  {SLOT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1">order_index</div>
                <Input value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} />
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1">state</div>
                <Select value={String(state)} onChange={(e) => setState(Number(e.target.value))} className="w-full">
                  <option value="1">✅ مفعّل</option>
                  <option value="0">⛔ غير مفعّل</option>
                </Select>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs text-slate-500 mb-1">content</div>
              <textarea
                className="w-full min-h-[220px] rounded-xl border border-slate-200 p-3 text-sm"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="اكتب النص هنا..."
              />
              <div className="mt-2 text-xs text-slate-500">
                ملاحظة: title و start_line عادة يكون order_index = 0
              </div>
            </div>

            {selectedRow ? (
              <div className="mt-4 text-xs text-slate-500">
                آخر تعديل: {selectedRow.updated_at || "—"}
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  );
}