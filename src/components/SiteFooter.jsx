import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="w-full border-t border-slate-200 bg-white/80">
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="text-xs text-slate-600">© 2026 ChuluQuiz — جميع الحقوق محفوظة</div>
        <div className="flex gap-4 text-xs">
          <Link className="text-slate-700 hover:underline" to="/privacy">سياسة الخصوصية</Link>
          <Link className="text-slate-700 hover:underline" to="/terms">شروط الاستخدام</Link>
          <Link className="text-slate-700 hover:underline" to="/about">من نحن</Link>
          <Link className="text-slate-700 hover:underline" to="/contact">اتصل بنا</Link>
        </div>
      </div>
    </footer>
  );
}