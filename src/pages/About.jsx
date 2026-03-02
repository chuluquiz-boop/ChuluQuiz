import { Link } from "react-router-dom";
export default function About() {
  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <div className="max-w-3xl mx-auto p-6">
        <Link
  to="/quiz"
  className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-xl bg-slate-100 text-slate-900 font-semibold hover:bg-slate-200 transition"
>
  ← الرجوع للكويز
</Link>
        <h1 className="text-2xl font-extrabold mb-4">من نحن</h1>
        <p className="text-slate-800 leading-7">
          ChuluQuiz منصة ترفيهية جزائرية لتنظيم مسابقات كويز مباشرة، بهدف نشر المتعة والمعرفة.
        </p>
      </div>
    </div>
  );
}