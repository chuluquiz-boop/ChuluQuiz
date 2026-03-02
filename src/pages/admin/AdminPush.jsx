import { useState } from "react";
import AdminLayout from "./AdminLayout.jsx";
import { apiFetch } from "../../lib/api.js";

export default function AdminPush() {
  const [title, setTitle] = useState("ChuluQuiz");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/quiz"); // ✅ يفتح هذا الرابط عند الضغط على الإشعار
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function send() {
    setMsg("");
    const t = title.trim() || "ChuluQuiz";
    const b = body.trim();
    const u = (url || "").trim();

    if (!b) {
      setMsg("❌ لازم تكتب نص الإشعار (Body).");
      return;
    }

    try {
      setLoading(true);

      // ✅ route الصحيح في الـ backend
      const res = await apiFetch("/api/admin/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, body: b, url: u }),
      });

      // ✅ يدعم الشكلين (إذا تغيّر الرد)
      const ok = res?.ok !== false;
      const success = res?.successCount ?? res?.sent ?? 0;
      const failed = res?.failureCount ?? res?.failed ?? 0;

      if (ok) {
        setMsg(`✅ تم الإرسال بنجاح: ${success} | فشل: ${failed}`);
        setBody("");
      } else {
        setMsg("❌ فشل الإرسال: " + (res?.message || "حدث خطأ"));
      }
    } catch (e) {
      setMsg("❌ خطأ: " + (e?.message || "حدث خطأ"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow p-6">
        <h1 className="text-xl font-bold">🔔 إرسال إشعار</h1>
        <p className="text-slate-600 mt-1">يرسل إشعار لكل اللاعبين الذين فعلوا الإشعارات.</p>

        <div className="mt-4">
          <label className="block text-sm font-semibold mb-1">العنوان (Title)</label>
          <input
            className="w-full h-11 rounded-xl border border-slate-200 px-3"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ChuluQuiz"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold mb-1">نص الإشعار (Body)</label>
          <textarea
            className="w-full min-h-[120px] rounded-xl border border-slate-200 p-3"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="مثال: الكويز يبدأ الآن! ادخل وشارك 🔥"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold mb-1">الرابط عند الضغط (اختياري)</label>
          <input
            className="w-full h-11 rounded-xl border border-slate-200 px-3"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/quiz"
          />
          <p className="text-xs text-slate-500 mt-1">
            مثال: /quiz أو /rules?quiz_id=... (لازم يكون داخل موقعك)
          </p>
        </div>

        <button
          onClick={send}
          disabled={loading}
          className="mt-4 w-full h-12 rounded-2xl bg-black text-white font-semibold disabled:opacity-60"
        >
          {loading ? "جاري الإرسال..." : "إرسال الآن"}
        </button>

        {msg ? <div className="mt-4 text-sm">{msg}</div> : null}
      </div>
    </AdminLayout>
  );
}