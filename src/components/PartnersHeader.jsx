import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function buildPublicUrl(bucket, path) {
  if (!path) return "";
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || "";
}

function Row({ label, item }) {
  if (!item) return null;

  return (
    <div className="flex items-center justify-center gap-3">
      <div className="text-xs sm:text-sm font-semibold text-slate-700">
        {label}
      </div>

      <div className="flex items-center gap-2">
        {item.logo_url ? (
          <img
            src={item.logo_url}
            alt={item.name}
            className="h-8 w-8 sm:h-9 sm:w-9 object-contain"
            loading="lazy"
          />
        ) : null}

        <div className="text-sm sm:text-base font-extrabold text-slate-900 tracking-wide">
          {item.name}
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

  const host = useMemo(
    () => rows.find((r) => r.kind === "host") || null,
    [rows]
  );
  const sponsor = useMemo(
    () => rows.find((r) => r.kind === "sponsor") || null,
    [rows]
  );

  // إذا ماكانش داتا، ما نعرضو والو (باش ما نفسدوش UI)
  if (!host && !sponsor) return null;

  return (
    <div
      className={[
        "w-full max-w-xl rounded-2xl bg-white/85 backdrop-blur-md shadow",
        "border border-white/40 px-4 py-3",
        className,
      ].join(" ")}
      dir="ltr"
    >
      {showTitle ? (
        <div className="text-center mb-2">
          <div className="text-[11px] uppercase tracking-[0.35em] text-slate-500">
            In-depth
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Row label="Hosted by" item={host} />
        <Row label="Sponsored by" item={sponsor} />
      </div>

      {err ? (
        <div className="mt-2 text-center text-[11px] text-rose-600">
          {err}
        </div>
      ) : null}
    </div>
  );
}