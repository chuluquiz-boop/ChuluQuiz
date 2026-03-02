import { Link } from "react-router-dom";
export default function Privacy() {
    return (
        <div className="min-h-screen bg-white" dir="rtl">
            <div className="max-w-3xl mx-auto p-6">
                <Link
                    to="/quiz"
                    className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-xl bg-slate-100 text-slate-900 font-semibold hover:bg-slate-200 transition"
                >
                    ← الرجوع للكويز
                </Link>
                <h1 className="text-2xl font-extrabold mb-4">سياسة الخصوصية</h1>
                <p className="text-sm text-slate-500 mb-6">آخر تحديث: 02/03/2026</p>

                <div className="space-y-5 text-slate-800 leading-7">
                    <p>
                        مرحبًا بكم في <b>ChuluQuiz</b>. نحن نحترم خصوصيتكم ونلتزم بحماية بياناتكم

                    </p>

                    <h2 className="text-lg font-bold">1) ما الذي نجمعه؟</h2>
                    <ul className="list-disc pr-6 space-y-1">
                        <li>اسم مستخدم قد لايدل ابدا على هوية اللاعب</li>
                        <li>بيانات اللعب: النقاط، ترتيبك، إجاباتك ووقت التفاعل (إن وُجد).</li>
                        <li>بيانات تقنية عامة (مثل أخطاء التطبيق) لتحسين الأداء.</li>
                    </ul>

                    <h2 className="text-lg font-bold">2) لماذا نجمع هذه البيانات؟</h2>
                    <ul className="list-disc pr-6 space-y-1">
                        <li>لتمكينك من المشاركة في الكويز وإظهار الترتيب.</li>
                        <li>لحساب النقاط ومنع تكرار الإجابات لنفس السؤال.</li>
                        <li>لتطوير المنصة وتحسين التجربة.</li>
                    </ul>

                    <h2 className="text-lg font-bold">3) ماذا لا نجمع؟</h2>
                    <p>
                        لا نطلب رقم هاتف ولا كلمة مرور ولا بريد إلكتروني في نظام الدخول الحالي.
                    </p>

                    <h2 className="text-lg font-bold">4) مشاركة البيانات</h2>
                    <p>
                        قد يظهر <b>اسم المشاركة</b> و<b>النقاط</b> و<b>الترتيب</b> في لوحة الصدارة.
                        لا نقوم ببيع البيانات أو مشاركتها لأغراض تجارية.
                    </p>

                    <h2 className="text-lg font-bold">5) مدة الاحتفاظ بالبيانات</h2>
                    <p>
                        نحتفظ ببيانات اللعب فقط أثناء سير الكويز  لتشغيل الترتيب والإحصائيات. يمكن للإدارة
                        تنظيف البيانات بشكل دوري.
                        حيث تحدف البيانات عند نهاية كل كويز
                    </p>

                    <h2 className="text-lg font-bold">6) حقوقك</h2>
                    <p>
                        يمكنك طلب حذف بيانات مشاركتك أو إخفاء اسمك من لوحة الصدارة عبر التواصل مع الإدارة.
                    </p>


                </div>
            </div>
        </div>
    );
}