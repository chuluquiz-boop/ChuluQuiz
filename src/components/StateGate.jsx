import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function StateGate({ stateKey, allowValue = 1, children, fallback = null }) {
  const [status, setStatus] = useState({ loading: true, allowed: false });

  useEffect(() => {
    let mounted = true;

    async function run(attempt = 1) {
      const { data, error } = await supabase
        .from("app_state")
        .select("state")
        .eq("key", stateKey)
        .maybeSingle();

      if (!mounted) return;

      // محاولة ثانية لو فشل مؤقت
      if ((error || !data) && attempt < 2) {
        setTimeout(() => run(attempt + 1), 400);
        return;
      }

      if (error || !data) {
        setStatus({ loading: false, allowed: false });
        return;
      }

      setStatus({ loading: false, allowed: Number(data.state) === allowValue });
    }

    run();
    return () => {
      mounted = false;
    };
  }, [stateKey, allowValue]);

  if (status.loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <div className="rounded-2xl bg-white p-4 shadow">جاري التحميل...</div>
      </div>
    );
  }

  if (!status.allowed) return fallback;
  return children;
}