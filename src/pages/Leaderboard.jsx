import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import PartnersHeader from "../components/PartnersHeader.jsx";

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
      {/* Backdrop */}
      <button
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="close"
      />

      {/* Premium Glass Modal */}
      <div className="relative w-full max-w-lg">
        {/* Gradient Border */}
        <div className="rounded-[28px] p-[1px] bg-gradient-to-r from-white/40 via-white/10 to-white/40 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
          
          {/* Glass Card */}
          <div className="rounded-[27px] bg-white/10 backdrop-blur-2xl border border-white/20 p-6">

            {/* Header Partners */}
            <div className="mb-4">
              <PartnersHeader showTitle={false} className="max-w-none" />
            </div>

            {/* Title Row */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white drop-shadow">
                🏆 الترتيب النهائي
              </h2>
              <button
                onClick={onClose}
                className="
                  rounded-xl
                  border border-white/30
                  px-3 py-1
                  text-sm
                  text-white
                  bg-white/10
                  hover:bg-white/20
                  transition
                "
              >
                إغلاق
              </button>
            </div>

            {loading ? (
              <div className="text-center text-white/80 py-8">
                جاري التحميل...
              </div>
            ) : err ? (
              <div className="text-center text-red-300 py-6">
                {err}
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center text-white/70 py-8">
                لا توجد نتائج بعد
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/20">
                
                {/* Table Header */}
                <div className="grid grid-cols-12 bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                  <div className="col-span-2">#</div>
                  <div className="col-span-7">الاسم</div>
                  <div className="col-span-3 text-left">النقاط</div>
                </div>

                {/* Rows */}
                <div className="max-h-[60vh] overflow-auto">
                  {rows.map((r, i) => (
                    <div
                      key={`${r.user_id}-${i}`}
                      className="
                        grid grid-cols-12
                        px-4 py-3
                        text-sm
                        border-t border-white/10
                        text-white
                        hover:bg-white/10
                        transition
                      "
                    >
                      <div className="col-span-2 font-bold">
                        {i + 1}
                      </div>
                      <div className="col-span-7 truncate">
                        {r.username}
                      </div>
                      <div className="col-span-3 text-left font-bold">
                        {r.score}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 text-xs text-white/60 text-center">
             شكرا لكل المشاركين! تابعونا للمزيد من المسابقات والجوائز 🎉
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}