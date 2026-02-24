import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function buildPublicUrl(bucket, path) {
  if (!path) return "";
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || "";
}

/**
 * Premium Row:
 * - Label ثابت (Hosted by / Sponsored by)
 * - Logo + Name "لاصقين"
 * - Name: Auto-fit (clamp) + ellipsis + no overflow
 */
function PremiumRow({ label, item }) {
  if (!item) return null;

  const name = item?.name || "";
  const logo = item?.logo_url || "";

  return (
    <div className="flex items-center justify-center gap-3">
      {/* Label */}
      <div className="text-[13px] sm:text-sm text-white/85 whitespace-nowrap drop-shadow">
        {label}
      </div>

      {/* Logo + Name */}
      <div className="flex items-center gap-2 min-w-0">
        {logo ? (
          <div className="relative shrink-0">
            <div className="absolute -inset-1 rounded-xl bg-white/15 blur-[6px]" />
            <img
              src={logo}
              alt={name}
              className="relative h-10 w-10 sm:h-11 sm:w-11 rounded-xl object-contain bg-white/10 border border-white/20"
              loading="lazy"
              draggable={false}
            />
          </div>
        ) : null}

        {/* Name auto-fit + ellipsis */}
        <div className="min-w-0">
          <div
            className="
              font-extrabold
              text-white
              leading-tight
              drop-shadow
              whitespace-nowrap
              overflow-hidden
              text-ellipsis
            "
            style={{
              // يصغر تلقائياً حسب العرض/الاسم
              fontSize: "clamp(14px, 3.6vw, 22px)",
              // مهم للهاتف حتى ما يتمددش بزاف
              maxWidth: "16.5rem",
            }}
            title={name}
          >
            {name}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PartnersHeader({
  bucket = "logos",
  className = "",
  showTitle = true,
}) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setErr("");

      const { data, error } = await supabase
        .from("partners")
        .select("kind,name,logo_path,order_index")
        .eq("state", 1)
        .order("order_index", { ascending: true });

      if (!mounted) return;

      if (error) {
        setErr(error.message || "Failed to load partners");
        setRows([]);
        return;
      }

      const enriched = (data || []).map((r) => ({
        ...r,
        logo_url: buildPublicUrl(bucket, r.logo_path),
      }));

      setRows(enriched);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [bucket]);

  const host = useMemo(() => rows.find((r) => r.kind === "host") || null, [rows]);
  const sponsor = useMemo(
    () => rows.find((r) => r.kind === "sponsor") || null,
    [rows]
  );

  // إذا ماكانش داتا، ما نعرضو والو (باش ما نفسدوش UI)
  if (!host && !sponsor) return null;

  return (
    <div className={["w-full max-w-[420px] sm:max-w-[560px]", className].join(" ")} dir="ltr">
      {/* IN-DEPTH */}
      {showTitle ? (
        <div className="text-center mb-2">
          <span className="inline-block text-[11px] sm:text-xs tracking-[0.45em] text-white/80 drop-shadow uppercase">
            IN-DEPTH
          </span>
        </div>
      ) : null}

      {/* Gradient Border Wrapper */}
      <div className="rounded-[22px] p-[1px] bg-gradient-to-r from-white/35 via-white/10 to-white/35 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
        {/* Glass Card */}
        <div
          className="
            rounded-[21px]
            bg-white/12
            backdrop-blur-2xl
            border border-white/15
            px-4 py-3
          "
        >
          <div className="flex flex-col gap-2">
            <PremiumRow label="Hosted by" item={host} />
            <PremiumRow label="Sponsored by" item={sponsor} />
          </div>

          {err ? (
            <div className="mt-2 text-center text-[11px] text-rose-200 drop-shadow">
              {err}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}