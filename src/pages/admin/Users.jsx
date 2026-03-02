import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { Card, CardBody, Button, Input, Select } from "../../components/ui.jsx";

function badge(text, cls) {
  return (
    <span className={`inline-flex px-3 py-1 rounded-full border text-xs font-semibold ${cls}`}>
      {text}
    </span>
  );
}

function stateBadge(state) {
  const s = Number(state);
  if (s === 0) return badge("Pending", "bg-slate-100 text-slate-700 border-slate-200");
  if (s === 1) return badge("Approved", "bg-emerald-100 text-emerald-700 border-emerald-200");
  if (s === 2) return badge("Rejected", "bg-rose-100 text-rose-700 border-rose-200");
  if (s === 3) return badge("Blocked", "bg-amber-100 text-amber-700 border-amber-200");
  return badge(`State ${s}`, "bg-slate-100 text-slate-700 border-slate-200");
}

function roleBadge(role) {
  const r = String(role || "user");
  if (r === "admin") return badge("Admin", "bg-indigo-100 text-indigo-700 border-indigo-200");
  return badge("User", "bg-slate-100 text-slate-700 border-slate-200");
}

function guestBadge(isGuest) {
  const g = !!isGuest;
  if (g) return badge("Guest", "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200");
  return badge("Normal", "bg-slate-100 text-slate-700 border-slate-200");
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function Users() {
  // ملاحظة: في مشروعك عندك VITE_API_URL في عدة صفحات
  const API = import.meta.env.VITE_API_URL || "";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState("");

  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [guestFilter, setGuestFilter] = useState("all"); // all | guests | normal

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
      const res = await fetch(`${API}/api/admin/users`);
      const data = await safeJson(res);

      if (!res.ok || !data.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      setUsers(data.users || []);
    } catch (e) {
      setMsg(e.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return (users || [])
      .filter((u) => {
        if (!query) return true;
        return (
          String(u.username || "").toLowerCase().includes(query) ||
          String(u.phone || "").toLowerCase().includes(query) ||
          String(u.id || "").toLowerCase().includes(query)
        );
      })
      .filter((u) => (stateFilter === "all" ? true : String(u.state) === stateFilter))
      .filter((u) => (roleFilter === "all" ? true : String(u.role || "user") === roleFilter))
      .filter((u) => {
        if (guestFilter === "all") return true;
        const g = !!u.is_guest;
        return guestFilter === "guests" ? g : !g;
      });
  }, [users, q, stateFilter, roleFilter, guestFilter]);

  const guestsCount = useMemo(() => (users || []).filter((u) => !!u.is_guest).length, [users]);

  async function setState(userId, state) {
    setBusyId(userId);
    setMsg("");
    try {
      const res = await fetch(`${API}/api/admin/users/${userId}/state`, {
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
      setBusyId(null);
    }
  }

  async function promote(userId) {
    const ok = window.confirm("ترقية هذا المستخدم إلى Admin؟");
    if (!ok) return;

    setBusyId(userId);
    setMsg("");
    try {
      const res = await fetch(`${API}/api/admin/users/${userId}/promote`, { method: "PATCH" });
      const data = await safeJson(res);
      if (!res.ok || !data.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      await load();
    } catch (e) {
      setMsg(e.message || "Failed to promote");
    } finally {
      setBusyId(null);
    }
  }

  async function removeUser(userId) {
    const ok = window.confirm("⚠️ حذف نهائي! هل أنت متأكد؟");
    if (!ok) return;

    setBusyId(userId);
    setMsg("");
    try {
      const res = await fetch(`${API}/api/admin/users/${userId}`, { method: "DELETE" });
      const data = await safeJson(res);
      if (!res.ok || !data.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      await load();
    } catch (e) {
      setMsg(e.message || "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }

  // ✅ NEW: حذف كل الضيوف (is_guest=true)
  async function cleanupGuests() {
    if (guestsCount === 0) {
      setMsg("لا يوجد ضيوف لحذفهم.");
      return;
    }

    const ok = window.confirm(
      `⚠️ سيتم حذف ${guestsCount} ضيف (is_guest=true) نهائياً.\nهل أنت متأكد؟`
    );
    if (!ok) return;

    setBusyId("cleanup");
    setMsg("");
    try {
      // لازم تكون ضفت endpoint في backend:
      // DELETE /api/admin/guests
      const res = await fetch(`${API}/api/admin/guests`, { method: "DELETE" });
      const data = await safeJson(res);
      if (!res.ok || !data.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      await load();
      setMsg("تم حذف الضيوف ✅");
    } catch (e) {
      setMsg(e.message || "Failed to cleanup guests");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminLayout title="Users" subtitle="قبول / رفض / حظر / حذف / ترقية + تنظيف الضيوف (Backend API)">
      <div className="grid gap-4">
        {msg && (
          <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">
            {msg}
          </div>
        )}

        <Card>
          <CardBody className="grid gap-4">
            <div className="grid sm:grid-cols-4 gap-3">
              <Input
                label="Search"
                placeholder="username / phone / id"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />

              <Select label="State" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="0">Pending</option>
                <option value="1">Approved</option>
                <option value="2">Rejected</option>
                <option value="3">Blocked</option>
              </Select>

              <Select label="Role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </Select>

              <Select label="Guests" value={guestFilter} onChange={(e) => setGuestFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="guests">Guests only</option>
                <option value="normal">Normal only</option>
              </Select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Total (filtered): <span className="font-semibold">{filtered.length}</span>
                {"  "}
                <span className="mx-2">•</span>
                Guests: <span className="font-semibold">{guestsCount}</span>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="danger" onClick={cleanupGuests} disabled={loading || busyId === "cleanup"}>
                  🧹 Delete Guests
                </Button>

                <Button variant="soft" onClick={load} disabled={loading}>
                  🔄 Refresh
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr className="text-left">
                  <th className="p-3">User</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">State</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td className="p-4 text-slate-500" colSpan={7}>
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td className="p-4 text-slate-500" colSpan={7}>
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const isBusy = busyId === u.id;
                    return (
                      <tr key={u.id} className="border-t border-slate-100">
                        <td className="p-3">
                          <div className="font-medium text-slate-900">{u.username || "—"}</div>
                          <div className="text-xs text-slate-500 font-mono">{u.id}</div>
                        </td>

                        <td className="p-3">{u.phone || "—"}</td>

                        <td className="p-3">{roleBadge(u.role)}</td>

                        <td className="p-3">{stateBadge(u.state)}</td>

                        <td className="p-3">{guestBadge(u.is_guest)}</td>

                        <td className="p-3 text-slate-600">{fmtDate(u.created_at)}</td>

                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="success"
                              className="px-3 py-1"
                              disabled={isBusy}
                              onClick={() => setState(u.id, 1)}
                            >
                              Approve
                            </Button>

                            <Button
                              variant="danger"
                              className="px-3 py-1"
                              disabled={isBusy}
                              onClick={() => setState(u.id, 2)}
                            >
                              Reject
                            </Button>

                            <Button
                              variant="warning"
                              className="px-3 py-1"
                              disabled={isBusy}
                              onClick={() => setState(u.id, 3)}
                            >
                              Block
                            </Button>

                            {String(u.role || "user") !== "admin" && (
                              <Button
                                variant="outline"
                                className="px-3 py-1"
                                disabled={isBusy}
                                onClick={() => promote(u.id)}
                              >
                                Make Admin
                              </Button>
                            )}

                            <Button
                              variant="soft"
                              className="px-3 py-1"
                              disabled={isBusy}
                              onClick={() => removeUser(u.id)}
                            >
                              Delete
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

        <div className="text-xs text-slate-500">
          ⚠️ للتجربة فقط: endpoints بدون حماية. بعد ما تتأكدي كل شيء شغال، نرجع نضيف حماية بسيطة.
        </div>

        <div className="text-xs text-slate-500">
          ✅ ملاحظة: حتى يبان “Guest/Normal” لازم يكون عندك عمود <span className="font-mono">is_guest</span> في جدول users
          و endpoint <span className="font-mono">DELETE /api/admin/guests</span> في الباك.
        </div>
      </div>
    </AdminLayout>
  );
}
