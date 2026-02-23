import { NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const navItems = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/create-quiz", label: "Create Quiz" },
  { to: "/admin/manage-quiz", label: "Manage Quiz" },
  { to: "/admin/quiz-control", label: "Quiz Control" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/app-state", label: "App State" },
  { to: "/admin/leaderboard", label: "Leaderboard" },
  { to: "/admin/live-stats", label: "Live Stats" },
  { to: "/admin/partners", label: "Partners" },
];

export default function AdminLayout({ title, subtitle, children }) {
  const nav = useNavigate();
  const username = localStorage.getItem("admin_username") || "Admin";

  function logout() {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user_id");
    localStorage.removeItem("admin_username");
    nav("/admin/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        <aside className="w-64 shrink-0">
          <div className="rounded-2xl bg-slate-900 text-white p-5 shadow-sm">
            <div className="text-xl font-semibold">ChuluQuiz</div>
            <div className="text-xs text-slate-300 mt-1">Admin Panel</div>

            <div className="mt-6 grid gap-2">
              {navItems.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-xl text-sm transition ${
                      isActive ? "bg-white/15" : "hover:bg-white/10"
                    }`
                  }
                >
                  {it.label}
                </NavLink>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-white/10">
              <div className="text-sm text-slate-200">👤 {username}</div>
              <button
                onClick={logout}
                className="mt-3 w-full rounded-xl bg-rose-600 hover:bg-rose-700 transition px-3 py-2 text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl bg-white border border-slate-200 shadow-sm"
          >
            <div className="p-6 border-b border-slate-200">
              <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
              {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}