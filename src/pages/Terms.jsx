import { Link } from "react-router-dom";
export default function Terms() {
    return (
        <div className="min-h-screen bg-white" dir="rtl">
            <div className="max-w-3xl mx-auto p-6">
                <Link
                    to="/quiz"
                    className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-xl bg-slate-100 text-slate-900 font-semibold hover:bg-slate-200 transition"
                >
                    ← الرجوع للكويز
                </Link>
                <h1 className="text-2xl font-extrabold mb-4">شروط الاستخدام</h1>
                <p className="text-sm text-slate-500 mb-6">آخر تحديث: 02/03/2026</p>

                <div className="space-y-5 text-slate-800 leading-7">
                    <p>
                        باستخدامك لمنصة <b>ChuluQuiz</b> أنت توافق على الشروط التالية:
                    </p>

                    <h2 className="text-lg font-bold">1) طبيعة الخدمة</h2>
                    <p>المنصة ترفيهية/ثقافية وتقدم مسابقات أسئلة وأجوبة.</p>

                    <h2 className="text-lg font-bold">2) اسم المشاركة</h2>
                    <ul className="list-disc pr-6 space-y-1">
                        <li>يجب اختيار اسم محترم وغير مسيء.</li>
                        <li>يمنع استعمال أسماء تحريضية أو مسيئة أو مخالفة للقانون.</li>
                    </ul>

                    <h2 className="text-lg font-bold">3) اللعب النزيه</h2>
                    <ul className="list-disc pr-6 space-y-1">
                        <li>يمنع الغش، استغلال الثغرات، أو استعمال بوتات.</li>
                        <li>الإدارة يمكنها إلغاء نتائج أي حساب مخالف.</li>
                    </ul>

                    <h2 className="text-lg font-bold">4) النقاط والجوائز</h2>
                    <p>
                        يتم احتساب النقاط وفق قواعد اللعبة المعروضة داخل المنصة. في حال وجود جوائز،
                        قرار الإدارة نهائي عند النزاعات.
                    </p>

                    <h2 className="text-lg font-bold">5) إخلاء المسؤولية</h2>
                    <p>
                        قد تتأثر التجربة بجودة الإنترنت أو الجهاز. المنصة غير مسؤولة عن انقطاعات خارجية.
                    </p>

                    <h2 className="text-lg font-bold">6) التعديلات</h2>
                    <p>يمكن تحديث الشروط، واستمرارك في الاستخدام يعني موافقتك على التحديثات.</p>
                </div>
            </div>
        </div>
    );
}