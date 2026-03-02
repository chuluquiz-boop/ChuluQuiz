import { Link } from "react-router-dom";
export default function Contact() {
    return (
        <div className="min-h-screen bg-white" dir="rtl">
            <div className="max-w-3xl mx-auto p-6">
                <Link
                    to="/quiz"
                    className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-xl bg-slate-100 text-slate-900 font-semibold hover:bg-slate-200 transition"
                >
                    ← الرجوع للكويز
                </Link>
                <h1 className="text-2xl font-extrabold mb-4">اتصل بنا</h1>
                <p className="text-slate-800 leading-7">
                    وسيلة التواصل الوحيدة هي فيسبوك او قناة تلغرام
                    <br />
                    - Facebook: ChuluQuiz –{" "}
                    <a
                        href="https://web.facebook.com/profile.php?id=61575643237719"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                    >
                        انقر هنا
                    </a>
                    <br /> <br />- Telegram: ChuluQuiz –{" "}
                    <a
                        href="https://t.me/ChuluQuiz"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                    >
                        انقر هنا
                    </a>

                </p>
            </div>
        </div>
    );
}