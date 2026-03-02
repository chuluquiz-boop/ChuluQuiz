import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import StateGate from "./components/StateGate";
import ManageQuiz from "./pages/admin/ManageQuiz";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import AdminLogin from "./pages/admin/AdminLogin";
import Dashboard from "./pages/admin/Dashboard";
import RequireAdminAuth from "./components/RequireAdminAuth";
import Quiz from "./pages/Quiz";
import NotAvailable from "./pages/NotAvailable";
import InstallButton from "./components/InstallButton";
import RequireAuth from "./components/RequireAuth";
import QuizControl from "./pages/admin/QuizControl";
import AdminLayout from "./pages/admin/AdminLayout";
import AppState from "./pages/admin/AppState";
import Users from "./pages/admin/Users";
import AdminLeaderboard from "./pages/admin/AdminLeaderboard";
import LiveStats from "./pages/admin/LiveStats";
import CreateQuiz from "./pages/admin/CreateQuiz";
import Partners from "./pages/admin/Partners";
import Rules from "./pages/Rules";
import AdminRules from "./pages/admin/AdminRules";
import AdminPush from "./pages/admin/AdminPush";

export default function App() {
  return (
    <BrowserRouter>
      {/* حافظ على خاصية install هنا */}
      <InstallButton />

      <Routes>
        <Route path="/" element={<Navigate to="/quiz" replace />} />



        <Route
          path="/login"
          element={
            <StateGate
              stateKey="login_enabled"
              allowValue={1}
              fallback={<NotAvailable />}
            >
              <Login />
            </StateGate>
          }
        />

        <Route
          path="/quiz"
          element={
            <StateGate stateKey="quiz_enabled" allowValue={1} fallback={<NotAvailable />}>
              <RequireAuth>
                <Quiz />
              </RequireAuth>
            </StateGate>
          }
        />

        <Route path="*" element={<NotAvailable />} />
        <Route path="/admin/login" element={<AdminLogin />} />

        <Route
          path="/admin/dashboard"
          element={
            <RequireAdminAuth>
              <Dashboard />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/quiz-control"
          element={
            <RequireAdminAuth>
              <QuizControl />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAdminAuth>
              <Users />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/app-state"
          element={
            <RequireAdminAuth>
              <AppState />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/leaderboard"
          element={
            <RequireAdminAuth>
              <AdminLeaderboard />
            </RequireAdminAuth>
          }
        />

        <Route
          path="/admin/live-stats"
          element={
            <RequireAdminAuth>
              <LiveStats />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/create-quiz"
          element={
            <RequireAdminAuth>
              <CreateQuiz />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/manage-quiz"
          element={
            <RequireAdminAuth>
              <ManageQuiz />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/rules"
          element={
            <StateGate stateKey="quiz_enabled" allowValue={1} fallback={<NotAvailable />}>
              <RequireAuth>
                <Rules />
              </RequireAuth>
            </StateGate>
          }
        />
        <Route
          path="/admin/partners"
          element={
            <RequireAdminAuth>
              <Partners />
            </RequireAdminAuth>
          }
        />
        <Route
          path="/admin/rules"
          element={
            <RequireAdminAuth>
              <AdminRules />
            </RequireAdminAuth>
          }
        />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/admin/push" element={<AdminPush />} />
      </Routes>
    </BrowserRouter>
  );
}