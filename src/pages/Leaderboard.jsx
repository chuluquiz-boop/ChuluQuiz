import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Leaderboard({ quizId, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!quizId) return;

      setErr("");
      setLoading(true);

      const { data, error } = await supabase
        .from("quiz_leaderboard")
        .select("user_id,username,score")
        .eq("quiz_id", quizId)
        .order("score", { ascending: false })
        .limit(100);

      if (!mounted) return;

      if (error) {
        setErr(error.message || "فشل تحميل الترتيب");
        setRows([]);
      } else {
        setRows(data || []);
      }

      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [quizId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      {/* backdrop */}
      <button onClick={onClose} className="absolute inset-0 bg-black/50" aria-label="close" />

      <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">🏆 الترتيب النهائي</h2>
          <button
            onClick={onClose}
            className="rounded-xl border px-3 py-1 text-sm hover:bg-slate-50"
          >
            إغلاق
          </button>
        </div>

        {loading ? (
          <div className="text-center text-slate-600 py-8">جاري التحميل...</div>
        ) : err ? (
          <div className="text-center text-red-600 py-6">{err}</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-slate-600 py-8">لا توجد نتائج بعد</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border">
            <div className="grid grid-cols-12 bg-slate-50 px-4 py-2 text-sm font-semibold">
              <div className="col-span-2">#</div>
              <div className="col-span-7">الاسم</div>
              <div className="col-span-3 text-left">النقاط</div>
            </div>

            <div className="max-h-[60vh] overflow-auto">
              {rows.map((r, i) => (
                <div key={`${r.user_id}-${i}`} className="grid grid-cols-12 px-4 py-3 text-sm border-t">
                  <div className="col-span-2 font-bold">{i + 1}</div>
                  <div className="col-span-7 truncate">{r.username}</div>
                  <div className="col-span-3 text-left font-bold">{r.score}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 text-xs text-slate-500 text-center">
          * عرض قراءة فقط — لا يتم تحديثه تلقائيًا
        </div>
      </div>
    </div>
  );
}