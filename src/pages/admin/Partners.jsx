import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { Card, CardBody, Button, Select, Input } from "../../components/ui.jsx";
import { apiFetch } from "../../lib/api.js";
import { supabase } from "../../lib/supabase";

function safeFileName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-.]+/g, "") // نخلي a-zA-Z0-9 _ - . فقط
    .replace(/-+/g, "-");
}

function publicUrlFor(bucket, path) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || "";
}

export default function Partners() {
  const BUCKET = "logos";
  const FOLDER = "companies";

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [partners, setPartners] = useState([]);

  // create form
  const [kind, setKind] = useState("host");
  const [name, setName] = useState("");
  const [state, setState] = useState(1);
  const [orderIndex, setOrderIndex] = useState(0);

  const [file, setFile] = useState(null); // ✅ ملف الصورة
  const autoLogoPath = useMemo(() => {
    const filename = safeFileName(file?.name || "");
    return filename ? `${FOLDER}/${filename}` : "";
  }, [file]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const data = await apiFetch("/api/admin/partners");
      setPartners(data.partners || []);
    } catch (e) {
      setMsg(e?.message || "Failed to load partners");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function uploadLogoIfAny() {
    // لازم file موجود
    if (!file) throw new Error("اختر صورة الشعار أولاً");

    const filename = safeFileName(file.name);
    if (!filename) throw new Error("اسم الملف غير صالح");

    const path = `${FOLDER}/${filename}`;

    // ✅ نخليها overwrite: إذا كان موجود نحدّثه
    // Supabase upload ما يديرش overwrite إلا إذا upsert: true
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true });

    if (error) throw new Error(error.message);

    return path; // logo_path
  }

  async function createPartner() {
    setMsg("");
    if (String(name).trim().length < 2) {
      setMsg("اسم الشركة غير صالح");
      return;
    }
    if (!file) {
      setMsg("لازم تختار صورة الشعار");
      return;
    }

    setLoading(true);
    try {
      // 1) Upload
      const logo_path = await uploadLogoIfAny();

      // 2) Insert row
      const payload = {
        kind,
        name: String(name).trim(),
        logo_path,
        state: Number(state),
        order_index: Number(orderIndex) || 0,
      };

      const out = await apiFetch("/api/admin/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setPartners((prev) => {
        const next = [out.partner, ...prev];
        next.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        return next;
      });

      // reset
      setKind("host");
      setName("");
      setState(1);
      setOrderIndex(0);
      setFile(null);

      setMsg("✅ تم إضافة الشركة + رفع الشعار");
    } catch (e) {
      setMsg(e?.message || "Failed to create partner");
    } finally {
      setLoading(false);
    }
  }

  function updateLocal(id, patch) {
    setPartners((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function savePartner(p) {
    setMsg("");
    setLoading(true);
    try {
      const body = {
        kind: p.kind,
        name: p.name,
        logo_path: p.logo_path,
        state: Number(p.state),
        order_index: Number(p.order_index) || 0,
      };

      const out = await apiFetch(`/api/admin/partners/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setPartners((prev) => prev.map((x) => (x.id === p.id ? out.partner : x)));
      setMsg("✅ تم الحفظ");
    } catch (e) {
      setMsg(e?.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  async function deletePartner(id) {
    setMsg("");
    if (!confirm("متأكد تحب تحذف هاذ الشركة نهائياً؟")) return;

    setLoading(true);
    try {
      await apiFetch(`/api/admin/partners/${id}`, { method: "DELETE" });
      setPartners((prev) => prev.filter((x) => x.id !== id));
      setMsg("🗑️ تم الحذف");
    } catch (e) {
      setMsg(e?.message || "Failed to delete");
    } finally {
      setLoading(false);
    }
  }

  async function replaceLogo(partnerId) {
    setMsg("");
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;

      setLoading(true);
      try {
        const filename = safeFileName(f.name);
        const logo_path = `${FOLDER}/${filename}`;

        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(logo_path, f, { upsert: true });

        if (error) throw new Error(error.message);

        // update row logo_path automatically
        const out = await apiFetch(`/api/admin/partners/${partnerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logo_path }),
        });

        setPartners((prev) => prev.map((x) => (x.id === partnerId ? out.partner : x)));
        setMsg("✅ تم تغيير الشعار");
      } catch (e) {
        setMsg(e?.message || "Failed to replace logo");
      } finally {
        setLoading(false);
      }
    };
    input.click();
  }

  async function move(id, dir) {
    const idx = partners.findIndex((p) => p.id === id);
    if (idx < 0) return;

    const otherIdx = idx + dir;
    if (otherIdx < 0 || otherIdx >= partners.length) return;

    const a = partners[idx];
    const b = partners[otherIdx];

    const aOrder = Number(a.order_index) || 0;
    const bOrder = Number(b.order_index) || 0;

    const nextA = { ...a, order_index: bOrder };
    const nextB = { ...b, order_index: aOrder };

    const next = [...partners];
    next[idx] = nextA;
    next[otherIdx] = nextB;
    next.sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0));
    setPartners(next);

    try {
      await apiFetch(`/api/admin/partners/${a.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_index: nextA.order_index }),
      });
      await apiFetch(`/api/admin/partners/${b.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_index: nextB.order_index }),
      });
      setMsg("✅ تم الترتيب");
    } catch (e) {
      setMsg(e?.message || "Failed to reorder");
      load();
    }
  }

  return (
    <AdminLayout
      title="Partners"
      subtitle="إدارة Host/Sponsor + رفع شعار من الواجهة (companies/<اسم_الملف>)"
    >
      <div className="grid gap-6">
        <Card>
          <CardBody className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <Select label="Kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="host">Host (مُضيف)</option>
                <option value="sponsor">Sponsor (راعي)</option>
              </Select>

              <Input
                label="Company Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sonelgaz"
              />

              <Select label="State" value={state} onChange={(e) => setState(Number(e.target.value))}>
                <option value={1}>1 - Active</option>
                <option value={0}>0 - Pending</option>
                <option value={2}>2 - Rejected</option>
                <option value={3}>3 - Blocked</option>
              </Select>

              <Input
                label="Order"
                type="number"
                value={orderIndex}
                onChange={(e) => setOrderIndex(Number(e.target.value))}
                placeholder="0"
              />

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-600">Logo file</label>
                <input
                  type="file"
                  accept="image/*"
                  className="block w-full text-sm"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-slate-700">
                ✅ <b>auto logo_path</b>:{" "}
                <span className="font-mono">{autoLogoPath || "— اختر ملف —"}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                path يتولد من اسم ملف الصورة مباشرة: <span className="font-mono">companies/&lt;filename&gt;</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={createPartner} disabled={loading}>
                + Add (Upload + Save)
              </Button>
              <Button variant="soft" onClick={load} disabled={loading}>
                Refresh
              </Button>

              {msg ? (
                <div className="ml-auto text-sm text-slate-700 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2">
                  {msg}
                </div>
              ) : null}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-2 pr-3">Preview</th>
                    <th className="py-2 pr-3">Order</th>
                    <th className="py-2 pr-3">Kind</th>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">logo_path</th>
                    <th className="py-2 pr-3">State</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {partners.map((p) => {
                    const url = p.logo_path ? publicUrlFor(BUCKET, p.logo_path) : "";
                    return (
                      <tr key={p.id} className="border-b last:border-b-0 align-top">
                        <td className="py-3 pr-3 min-w-[120px]">
                          {url ? (
                            <img
                              src={url}
                              alt={p.name}
                              className="h-10 w-10 object-contain rounded"
                              loading="lazy"
                            />
                          ) : (
                            <div className="text-slate-400">—</div>
                          )}
                        </td>

                        <td className="py-3 pr-3 min-w-[160px]">
                          <div className="flex items-center gap-2">
                            <Button variant="soft" onClick={() => move(p.id, -1)} disabled={loading}>
                              ↑
                            </Button>
                            <Button variant="soft" onClick={() => move(p.id, 1)} disabled={loading}>
                              ↓
                            </Button>
                            <input
                              className="w-20 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
                              type="number"
                              value={p.order_index ?? 0}
                              onChange={(e) => updateLocal(p.id, { order_index: Number(e.target.value) })}
                            />
                          </div>
                        </td>

                        <td className="py-3 pr-3 min-w-[170px]">
                          <select
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
                            value={p.kind}
                            onChange={(e) => updateLocal(p.id, { kind: e.target.value })}
                          >
                            <option value="host">Host (مضيف)</option>
                            <option value="sponsor">Sponsor (راعي)</option>
                          </select>
                        </td>

                        <td className="py-3 pr-3 min-w-[220px]">
                          <input
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
                            value={p.name || ""}
                            onChange={(e) => updateLocal(p.id, { name: e.target.value })}
                          />
                        </td>

                        <td className="py-3 pr-3 min-w-[320px]">
                          <input
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none font-mono"
                            value={p.logo_path || ""}
                            onChange={(e) => updateLocal(p.id, { logo_path: e.target.value })}
                          />
                          <div className="mt-2">
                            <Button variant="soft" onClick={() => replaceLogo(p.id)} disabled={loading}>
                              Replace Logo (Upload)
                            </Button>
                          </div>
                        </td>

                        <td className="py-3 pr-3 min-w-[160px]">
                          <select
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
                            value={Number(p.state)}
                            onChange={(e) => updateLocal(p.id, { state: Number(e.target.value) })}
                          >
                            <option value={1}>1 - Active</option>
                            <option value={0}>0 - Pending</option>
                            <option value={2}>2 - Rejected</option>
                            <option value={3}>3 - Blocked</option>
                          </select>
                        </td>

                        <td className="py-3 pr-3 min-w-[240px]">
                          <div className="flex gap-2">
                            <Button onClick={() => savePartner(p)} disabled={loading}>
                              Save
                            </Button>
                            <Button variant="danger" onClick={() => deletePartner(p.id)} disabled={loading}>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!partners.length ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        لا توجد شركات بعد.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  );
}