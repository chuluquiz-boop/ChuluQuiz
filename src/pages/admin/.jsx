import { useState } from "react";
import AdminLayout from "./AdminLayout.jsx";
import { apiFetch } from "../../lib/api.js";

export default function AdminPush() {
  const [title, setTitle] = useState("ChuluQuiz");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function send() {
    setMsg("");
    const b = body.trim();
    if (!b) {
      setMsg("❌ لازم تكتب نص الإشعار (body).");
      return;
    }

    try {
      setLoading(true);
      const res = await apiFetch("/api/admin/push/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || "ChuluQuiz", body: b }),
      });

      setMsg(`✅ تم الإرسال: ${res.sent || 0} | فشل: ${res.failed || 0} | حذف توكنات غير صالحة: ${res.removed_bad || 0}`);
      setBody("");
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