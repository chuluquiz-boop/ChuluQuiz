import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useMyParticipations(enabled) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setError("");
      setLoading(true);

      const userIdRaw = localStorage.getItem("user_id");
      const userId = Number(userIdRaw);

      if (!userIdRaw || Number.isNaN(userId)) {
        setItems([]);
        return;
      }

      // 1) المشاركات + معلومات الكويز
      const { data: players, error: pErr } = await supabase
        .from("quiz_players")
        .select(
          `
          quiz_id,
          joined_at,
          quiz:quizzes ( id, title, description, created_at )
        `
        )
        .eq("user_id", userId)
        .order("joined_at", { ascending: false });

      if (pErr) throw pErr;

      const quizIds = (players || []).map((r) => r.quiz_id).filter(Boolean);

      // 2) السكور لكل كويز
      let scoresMap = {};
      if (quizIds.length) {
        const { data: scores, error: sErr } = await supabase
          .from("quiz_scores")
          .select("quiz_id, score")
          .eq("user_id", userId)
          .in("quiz_id", quizIds);

        if (!sErr && scores) {
          scoresMap = Object.fromEntries(scores.map((x) => [x.quiz_id, x.score]));
        }
      }

      const list = (players || []).map((r) => ({
        quiz_id: r.quiz_id,
        joined_at: r.joined_at,
        title: r.quiz?.title || "بدون عنوان",
        description: r.quiz?.description || "",
        created_at: r.quiz?.created_at || null,
        score: scoresMap[r.quiz_id] ?? 0,
      }));

      setItems(list);
    } catch (e) {
      console.warn("useMyParticipations refresh failed:", e);
      setError("تعذر تحميل مشاركاتك الآن.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  return { loading, items, error, refresh };
}