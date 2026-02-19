import { useState, useEffect } from "react";
import { timeAgo } from "@/lib/timeAgo";

export function useTimeAgo(date: string | Date | null | undefined, intervalMs = 10000): string {
  const [text, setText] = useState(() => timeAgo(date));

  useEffect(() => {
    setText(timeAgo(date));
    if (!date) return;

    const id = setInterval(() => {
      setText(timeAgo(date));
    }, intervalMs);

    return () => clearInterval(id);
  }, [date, intervalMs]);

  return text;
}

export function useTimeAgoMap(dates: Record<string, string | Date | null | undefined>, intervalMs = 10000): Record<string, string> {
  const [texts, setTexts] = useState<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    for (const [key, date] of Object.entries(dates)) {
      result[key] = timeAgo(date);
    }
    return result;
  });

  useEffect(() => {
    const update = () => {
      const result: Record<string, string> = {};
      for (const [key, date] of Object.entries(dates)) {
        result[key] = timeAgo(date);
      }
      setTexts(result);
    };

    update();

    const id = setInterval(update, intervalMs);
    return () => clearInterval(id);
  }, [JSON.stringify(dates), intervalMs]);

  return texts;
}
