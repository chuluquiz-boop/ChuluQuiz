import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardHeader, CardBody, Button, Input } from "../../components/ui";

export default function AdminLogin() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data = null;
      if (contentType.includes("application/json")) data = await res.json();
      else {
        const text = await res.text();
        throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 120)}`);
      }

      if (!res.ok || !data.ok) {
        setMsg(data?.message || `خطأ ${res.status}`);
        return;
      }

      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin_user_id", data.user_id);
      localStorage.setItem("admin_username", data.username);

      nav("/admin/dashboard", { replace: true });
    } catch (err) {
      setMsg(err?.message || "خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <Card className="overflow-hidden">
          <CardHeader
            title="Admin Login"
            subtitle="أدخل بيانات الأدمن للوصول إلى لوحة التحكم"
          />
          <CardBody>
            <form onSubmit={onSubmit} className="grid gap-4">
              <Input
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="admin"
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />

              {msg && (
                <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
                  {msg}
                </div>
              )}

              <Button disabled={loading} className="w-full">
                {loading ? "..." : "دخول"}
              </Button>
            </form>
          </CardBody>
        </Card>

        <p className="text-xs text-slate-400 mt-4 text-center">
          ChuluQuiz Admin Panel
        </p>
      </motion.div>
    </div>
  );
}