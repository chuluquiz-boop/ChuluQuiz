import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout.jsx";
import { Card, CardBody, Button, Input } from "../../components/ui.jsx";

// مفاتيح الحالات المستعملة في التطبيق (StateGate)
const DEFAULT_KEYS = [
  { key: "register_enabled", label: "Register Page" },
  { key: "login_enabled", label: "Login Page" },
  { key: "quiz_enabled", label: "Quiz Page" },
];

function badge(text, cls) {
  return (
    <span className={`inline-flex px-3 py-1 rounded-full border text-xs font-semibold ${cls}`}>
      {text}
    </span>
  );
}

function stateBadge(state) {
  const s = Number(state);
  if (s === 1) return badge("OPEN", "bg-emerald-100 text-emerald-700 border-emerald-200");
  return badge("CLOSED", "bg-rose-100 text-rose-700 border-rose-200");
}

export default function AppState() {
  const API = import.meta.env.VITE_API_URL;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const [msg, setMsg] = useState("");

  const [newKey, setNewKey] = useState("");

  async function safeJson(res) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    const text = await res.text();
    throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 160)}`);
  }

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`${API}/api/admin/app-state`);
      const data = await safeJson(res);
      if (!res.ok || !data.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setRows(data.rows || []);
    } catch (e) {
      setMsg(e.message || "Failed to load app_state");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const merged = useMemo(() => {
    // ندمج المفاتيح الافتراضية مع ما هو موجود في DB
    const map = new Map();
    for (const r of rows || []) map.set(String(r.key), r);

    const out = [];

    for (const k of DEFAULT_KEYS) {
      const r = map.get(k.key);
      out.push({
        key: k.key,
        label: k.label,
        state: r ? Number(r.state) : 0,
        updated_at: r?.updated_at || null,
        _missing: !r,
      });
      map.delete(k.key);
    }

    // أي مفاتيح أخرى (custom)
    for (const [key, r] of map.entries()) {
      out.push({
        key,
        label: "Custom",
        state: Number(r.state),
        updated_at: r.updated_at || null,
        _missing: false,
      });
    }

    return out;
  }, [rows]);

  async function setKeyState(key, state) {
    setBusyKey(key);
    setMsg("");
    try {
      const res = await fetch(`${API}/api/admin/app-state/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });
      const data = await safeJson(res);
      if (!res.ok || !data.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      await load();
    } catch (e) {
      setMsg(e.message || "Failed to update state");
    } finally {
      setBusyKey(null);
    }
  }

  async function createKey() {
    const k = newKey.trim();
    if (!k) return;

    // keys بنفس النمط
    const safe = k.replace(/\s+/g, "_").toLowerCase();
    setNewKey(safe);

    await setKeyState(safe, 0); // ينشئها مغلقة
    setNewKey("");
  }

  return (
    <AdminLayout title="App State" subtitle="فتح/غلق صفحات التطبيق عبر جدول app_state (StateGate)">
      <div className="grid gap-4">
        {msg && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
            {msg}
          </div>
        )}

        <Card>
          <CardBody className="grid gap-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="min-w-[240px]">
                <Input
                  label="Add custom key"
                  placeholder="مثال: leaderboard_enabled"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                />
              </div>
              <Button variant="primary" onClick={createKey} disabled={!newKey.trim()}>
                + Add
              </Button>
              <Button variant="soft" onClick={load} disabled={loading}>
                🔄 Refresh
              </Button>
            </div>

            <div className="text-xs text-slate-500">
              القيمة <span className="font-semibold">1</span> = OPEN ، والقيمة{" "}
              <span className="font-semibold">0</span> = CLOSED
            </div>
          </CardBody>
        </Card>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr className="text-left">
                  <th className="p-3">Key</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Updated</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td className="p-4 text-slate-500" colSpan={5}>
                      Loading...
                    </td>
                  </tr>
                ) : merged.length === 0 ? (
                  <tr>
                    <td className="p-4 text-slate-500" colSpan={5}>
                      No keys.
                    </td>
                  </tr>
                ) : (
                  merged.map((r) => {
                    const isBusy = busyKey === r.key;
                    const updated = r.updated_at ? new Date(r.updated_at).toLocaleString() : "—";
                    return (
                      <tr key={r.key} className="border-t border-slate-100">
                        <td className="p-3">
                          <div className="font-medium text-slate-900">{r.key}</div>
                          {r._missing && (
                            <div className="text-xs text-amber-700 mt-1">
                              غير موجود في DB (سيتم إنشاؤه عند أول تحديث)
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-600">{r.label}</td>
                        <td className="p-3">{stateBadge(r.state)}</td>
                        <td className="p-3 text-slate-600">{updated}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="success"
                              className="px-3 py-1"
                              disabled={isBusy}
                              onClick={() => setKeyState(r.key, 1)}
                            >
                              Open
                            </Button>
                            <Button
                              variant="danger"
                              className="px-3 py-1"
                              disabled={isBusy}
                              onClick={() => setKeyState(r.key, 0)}
                            >
                              Close
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}