import { useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { useMyParticipations } from "../hooks/useMyParticipations";

function SectionCard({ title, children }) {
  return (
    <div className="w-full max-w-lg rounded-2xl bg-white/90 p-5 shadow">
      <div className="text-sm text-slate-500 mb-3">{title}</div>
      {children}
    </div>
  );
}

function Collapsible({ open, children }) {
  // Smooth collapse بدون مكتبات
  return (
    <div
      className={[
        "grid transition-all duration-300 ease-in-out",
        open ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0 mt-0",
      ].join(" ")}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

function ActionRow({ label, value, onToggle, open }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-right py-3 border-b last:border-b-0 flex items-center justify-between gap-3"
    >
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="font-bold text-slate-900 truncate">{value || "—"}</div>
      </div>

      <div className="shrink-0 text-sm font-semibold text-slate-700">
        {open ? "إغلاق" : "تعديل"}
      </div>
    </button>
  );
}

function ActionTitle({ title, subtitle, onToggle, open, danger }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        "w-full text-right py-3 border-b last:border-b-0 flex items-center justify-between gap-3",
        danger ? "text-red-700" : "",
      ].join(" ")}
    >
      <div className="min-w-0">
        <div className={["font-bold", danger ? "text-red-700" : "text-slate-900"].join(" ")}>
          {title}
        </div>
        {subtitle ? <div className="text-xs text-slate-500 mt-1">{subtitle}</div> : null}
      </div>

      <div className={["shrink-0 text-sm font-semibold", danger ? "text-red-700" : "text-slate-700"].join(" ")}>
        {open ? "إغلاق" : "فتح"}
      </div>
    </button>
  );
}

export default function NoQuizPanel({ username, onProfileUpdated, onDeleted }) {
  const me = useMemo(
    () => ({
      username: username || localStorage.getItem("username") || "",
      phone: localStorage.getItem("phone") || "",
    }),
    [username]
  );

  const [section, setSection] = useState("home"); // home | profile | participations

  // مشاركاتي
  const { loading, items, error, refresh } = useMyParticipations(section === "participations");

  // ✅ تحكم واحد فقط مفتوح (داخل الملف الشخصي)
  // name | phone | pass | delete | null
  const [openKey, setOpenKey] = useState(null);

  const toggle = (key) => setOpenKey((prev) => (prev === key ? null : key));

  // حقول تعديل الاسم/الهاتف
  const [newUsername, setNewUsername] = useState(me.username);
  const [newPhone, setNewPhone] = useState(me.phone);

  // كلمات سر للتأكيد (لكل عملية)
  const [passForName, setPassForName] = useState("");
  const [passForPhone, setPassForPhone] = useState("");

  // تغيير كلمة السر
  const [cpPass, setCpPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");

  // حذف الحساب
  const [delPass, setDelPass] = useState("");

  const [busy, setBusy] = useState(false);
  const sessionToken = localStorage.getItem("session_token") || "";

  async function saveUsername() {
    try {
      if (!passForName || passForName.length < 6) return alert("أدخل كلمة السر الحالية");
      if (!newUsername || newUsername.trim().length < 2) return alert("اسم المستخدم غير صالح");
      setBusy(true);

      const res = await apiFetch("/api/me/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: sessionToken,
          current_password: passForName,
          username: newUsername.trim(),
        }),
      });

      if (res?.username) localStorage.setItem("username", res.username);
      setPassForName("");
      setOpenKey(null);
      alert("تم تحديث الاسم ✅");
      onProfileUpdated?.(res);
    } catch (e) {
      alert(e.message || "فشل تحديث الاسم");
    } finally {
      setBusy(false);
    }
  }

  async function savePhone() {
    try {
      if (!passForPhone || passForPhone.length < 6) return alert("أدخل كلمة السر الحالية");

      const digits = String(newPhone || "").replace(/\D/g, "");
      if (digits.length !== 10) return alert("رقم الهاتف يجب أن يكون 10 أرقام");

      setBusy(true);

      const res = await apiFetch("/api/me/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: sessionToken,
          current_password: passForPhone,
          phone: digits,
        }),
      });

      if (res?.phone != null) localStorage.setItem("phone", String(res.phone));
      setPassForPhone("");
      setOpenKey(null);
      alert("تم تحديث رقم الهاتف ✅");
      onProfileUpdated?.(res);
    } catch (e) {
      alert(e.message || "فشل تحديث رقم الهاتف");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    try {
      if (!cpPass || cpPass.length < 6) return alert("أدخل كلمة السر الحالية");
      if (!newPass || newPass.length < 6) return alert("كلمة السر الجديدة لازم 6 أحرف على الأقل");
      if (newPass !== newPass2) return alert("تأكيد كلمة السر غير مطابق");

      setBusy(true);

      await apiFetch("/api/me/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: sessionToken,
          current_password: cpPass,
          new_password: newPass,
        }),
      });

      setCpPass("");
      setNewPass("");
      setNewPass2("");
      setOpenKey(null);
      alert("تم تغيير كلمة السر ✅");
    } catch (e) {
      alert(e.message || "فشل تغيير كلمة السر");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    const ok = window.confirm("⚠️ حذف الحساب نهائي ولا يمكن التراجع عنه. هل أنت متأكد؟");
    if (!ok) return;

    try {
      if (!delPass || delPass.length < 6) return alert("أدخل كلمة السر الحالية");
      setBusy(true);

      await apiFetch("/api/me/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: sessionToken,
          current_password: delPass,
        }),
      });

      localStorage.removeItem("session_token");
      localStorage.removeItem("quiz_token");
      localStorage.removeItem("token");
      localStorage.removeItem("user_id");
      localStorage.removeItem("username");
      localStorage.removeItem("phone");

      alert("تم حذف الحساب ✅");
      onDeleted?.();
    } catch (e) {
      alert(e.message || "فشل حذف الحساب");
    } finally {
      setBusy(false);
    }
  }

  const lsUsername = localStorage.getItem("username") || me.username;
  const lsPhone = localStorage.getItem("phone") || me.phone;

  return (
    <div className="w-full max-w-lg">
      {/* الرسالة البسيطة */}
      <div className="w-full rounded-2xl bg-white/90 p-6 shadow text-center">
        <h1 className="text-2xl font-bold mb-2">
          مرحبا، <span className="text-slate-900">{lsUsername}</span> 👋
        </h1>
        <h2 className="text-xl font-bold mb-1">لا يوجد كويز قادم الآن</h2>
        <p className="text-slate-600 mb-4">عند إضافة كويز مستقبلاً سيظهر هنا.</p>

        <div className="flex justify-center">
          <select
            className="h-11 w-full max-w-xs rounded-2xl border bg-white px-4 text-right shadow-sm"
            value={section}
            onChange={(e) => {
              setSection(e.target.value);
              // ✅ كل ما تبدّل القسم، سكّر أي collapsible مفتوح
              setOpenKey(null);
            }}
          >
            <option value="home">اختر…</option>
            <option value="profile">👤 الملف الشخصي</option>
            <option value="participations">🏁 مشاركاتي</option>
          </select>
        </div>
      </div>

      {/* ===== الملف الشخصي (Collapsible) ===== */}
      {section === "profile" && (
        <div className="mt-4 grid gap-4">
          <SectionCard title="معلومات الحساب">
            {/* اسم المستخدم */}
            <ActionRow
              label="اسم المستخدم"
              value={lsUsername}
              open={openKey === "name"}
              onToggle={() => toggle("name")}
            />
            <Collapsible open={openKey === "name"}>
              <div className="rounded-2xl border bg-white p-4">
                <div className="grid gap-3">
                  <input
                    className="h-12 w-full rounded-2xl border bg-white px-4"
                    placeholder="اسم المستخدم الجديد"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                  />
                  <input
                    className="h-12 w-full rounded-2xl border bg-white px-4"
                    placeholder="كلمة السر الحالية للتأكيد"
                    type="password"
                    value={passForName}
                    onChange={(e) => setPassForName(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={saveUsername}
                    disabled={busy}
                    className="h-12 w-full rounded-2xl bg-black/90 text-white shadow disabled:opacity-60"
                  >
                    حفظ الاسم
                  </button>
                </div>
              </div>
            </Collapsible>

            {/* رقم الهاتف */}
            <ActionRow
              label="رقم الهاتف"
              value={lsPhone}
              open={openKey === "phone"}
              onToggle={() => toggle("phone")}
            />
            <Collapsible open={openKey === "phone"}>
              <div className="rounded-2xl border bg-white p-4">
                <div className="grid gap-3">
                  <input
                    className="h-12 w-full rounded-2xl border bg-white px-4"
                    placeholder="رقم الهاتف الجديد"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                  />
                  <input
                    className="h-12 w-full rounded-2xl border bg-white px-4"
                    placeholder="كلمة السر الحالية للتأكيد"
                    type="password"
                    value={passForPhone}
                    onChange={(e) => setPassForPhone(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={savePhone}
                    disabled={busy}
                    className="h-12 w-full rounded-2xl bg-black/90 text-white shadow disabled:opacity-60"
                  >
                    حفظ رقم الهاتف
                  </button>
                </div>
              </div>
            </Collapsible>
          </SectionCard>

          {/* تغيير كلمة السر (عنوان فقط يفتح) */}
          <SectionCard title="الأمان">
            <ActionTitle
              title="تغيير كلمة السر"
              subtitle="اضغط لفتح النموذج"
              open={openKey === "pass"}
              onToggle={() => toggle("pass")}
            />
            <Collapsible open={openKey === "pass"}>
              <div className="rounded-2xl border bg-white p-4">
                <div className="grid gap-3">
                  <input
                    className="h-12 w-full rounded-2xl border bg-white px-4"
                    placeholder="كلمة السر الحالية"
                    type="password"
                    value={cpPass}
                    onChange={(e) => setCpPass(e.target.value)}
                  />
                  <input
                    className="h-12 w-full rounded-2xl border bg-white px-4"
                    placeholder="كلمة السر الجديدة"
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                  />
                  <input
                    className="h-12 w-full rounded-2xl border bg-white px-4"
                    placeholder="تأكيد كلمة السر الجديدة"
                    type="password"
                    value={newPass2}
                    onChange={(e) => setNewPass2(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={changePassword}
                    disabled={busy}
                    className="h-12 w-full rounded-2xl bg-black/90 text-white shadow disabled:opacity-60"
                  >
                    تغيير كلمة السر
                  </button>
                </div>
              </div>
            </Collapsible>

            {/* حذف الحساب (عنوان فقط يفتح) */}
            <ActionTitle
              title="حذف الحساب نهائياً"
              subtitle="تحذير: لا يمكن التراجع"
              open={openKey === "delete"}
              onToggle={() => toggle("delete")}
              danger
            />
            <Collapsible open={openKey === "delete"}>
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="text-sm text-red-700 mb-3">
                  ⚠️ حذف الحساب نهائي ولا يمكن التراجع عنه.
                </div>

                <input
                  className="h-12 w-full rounded-2xl border bg-white px-4 mb-3"
                  placeholder="كلمة السر الحالية للتأكيد"
                  type="password"
                  value={delPass}
                  onChange={(e) => setDelPass(e.target.value)}
                />

                <button
                  type="button"
                  onClick={deleteAccount}
                  disabled={busy}
                  className="h-12 w-full rounded-2xl bg-red-600 text-white shadow disabled:opacity-60"
                >
                  حذف الحساب نهائياً
                </button>
              </div>
            </Collapsible>
          </SectionCard>
        </div>
      )}

      {/* ===== مشاركاتي ===== */}
      {section === "participations" && (
        <div className="mt-4">
          <SectionCard title="مشاركاتي">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-sm text-slate-600">سجل مشاركاتك ونتائجك</div>
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className="h-10 px-4 rounded-2xl bg-black/90 text-white shadow disabled:opacity-60"
              >
                {loading ? "..." : "تحديث"}
              </button>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="text-slate-600">جاري التحميل...</div>
            ) : items.length === 0 ? (
              <div className="text-slate-600">لا توجد مشاركات بعد.</div>
            ) : (
              <div className="grid gap-3">
                {items.map((p) => (
                  <div key={p.quiz_id} className="rounded-2xl border bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{p.title}</div>
                        {p.description ? (
                          <div className="text-sm text-slate-600 mt-1 line-clamp-2">
                            {p.description}
                          </div>
                        ) : null}
                        <div className="text-xs text-slate-500 mt-2">
                          شاركت في: {p.joined_at ? new Date(p.joined_at).toLocaleString() : "—"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-slate-500">النقاط</div>
                        <div className="text-2xl font-extrabold tabular-nums">{p.score}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}