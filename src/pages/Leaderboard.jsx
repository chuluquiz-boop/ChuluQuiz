import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import PartnersHeader from "../components/PartnersHeader.jsx";

function fmtAvgSeconds(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0 || n > 1e8) return "—";
  return (n / 1000).toFixed(2);
}

export default function Leaderboard({ quizId, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ✅ نعرف واش كاين تعادل في النقاط (باش نعرض سبب كسر التعادل)
  const hasScoreTie = useMemo(() => {
    if (!Array.isArray(rows) || rows.length < 2) return false;
    const counts = new Map();
    for (const r of rows) {
      const s = Number(r?.score);
      if (!Number.isFinite(s)) continue;
      counts.set(s, (counts.get(s) || 0) + 1);
    }
    for (const v of counts.values()) if (v >= 2) return true;
    return false;
  }, [rows]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!quizId) return;

      setErr("");
      setLoading(true);

      // ✅ الترتيب الجديد:
      // 1) النقاط desc
      // 2) أقل استعمال للخواص asc
      // 3) أسرع متوسط وقت في الإجابات الصحيحة asc
      // 4) كسر تعادل ثابت user_id
      const { data, error } = await supabase
        .from("quiz_leaderboard")
        .select("user_id,username,score,lifelines_used,avg_correct_ms")
        .eq("quiz_id", quizId)
        .order("score", { ascending: false })
        .order("lifelines_used", { ascending: true })
        .order("avg_correct_ms", { ascending: true })
        .order("user_id", { ascending: true })
        .limit(100);

      if (!mounted) return;

      if (error) {
        setErr(error.message || "فشل تحميل الترتيب");
        setRows([]);
      } else {
        setRows(Array.isArray(data) ? data : []);
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
        type="button"
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
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-white drop-shadow">🏆 الترتيب النهائي</h2>

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
                type="button"
              >
                إغلاق
              </button>
            </div>

            {/* ✅ شرح كسر التعادل */}
            <div className="mb-4 rounded-2xl border border-white/20 bg-white/10 p-3 text-[12px] text-white/85 leading-relaxed">
              <div className="font-semibold mb-1">🧩 كسر التعادل:</div>
              <div>1) النقاط الأعلى</div>
              <div>2) الأقل استعمالًا للخواص (تلميح + 50/50)</div>
              <div>3) الأسرع في الإجابات الصحيحة (متوسط الوقت)</div>
            </div>

            {loading ? (
              <div className="text-center text-white/80 py-8">جاري التحميل...</div>
            ) : err ? (
              <div className="text-center text-red-300 py-6">{err}</div>
            ) : rows.length === 0 ? (
              <div className="text-center text-white/70 py-8">لا توجد نتائج بعد</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/20">
                {/* Table Header */}
                <div className="grid grid-cols-12 bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                  <div className="col-span-2">#</div>
                  <div className="col-span-6">الاسم</div>
                  <div className="col-span-2 text-left">النقاط</div>
                  <div className="col-span-2 text-left">التعادل</div>
                </div>

                {/* Rows */}
                <div className="max-h-[60vh] overflow-auto">
                  {rows.map((r, i) => {
                    const lifelinesUsed = Number(r?.lifelines_used);
                    const safeLifelines = Number.isFinite(lifelinesUsed) ? lifelinesUsed : 0;

                    const avgSec = fmtAvgSeconds(r?.avg_correct_ms);

                    // ✅ الفائز: أول واحد في الترتيب
                    const isWinner = i === 0;

                    return (
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
                        <div className="col-span-2 font-bold">{i + 1}</div>

                        <div className="col-span-6 truncate flex items-center gap-2">
                          <span className="truncate">{r.username}</span>

                          {isWinner ? (
                            <span
                              className="
                                shrink-0
                                text-[11px]
                                px-2 py-0.5
                                rounded-full
                                bg-white/20
                                border border-white/30
                                text-white
                              "
                              title="الفائز"
                            >
                              الفائز ✅
                            </span>
                          ) : null}
                        </div>

                        <div className="col-span-2 text-left font-bold">{r.score}</div>

                        <div className="col-span-2 text-left text-[12px] text-white/85">
                          {hasScoreTie ? (
                            <div className="leading-tight">
                              <div className="font-semibold">خواص: {safeLifelines}/2</div>
                              <div>سرعة: {avgSec}ث</div>
                            </div>
                          ) : (
                            <span className="text-white/60">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
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