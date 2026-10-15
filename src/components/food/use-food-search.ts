"use client";

import { useDeferredValue, useEffect, useState } from "react";
import type { LoggableFood, LoggableRecipe } from "@/server/loggable";

export type SearchResults = { foods: LoggableFood[]; recipes: LoggableRecipe[] };

export function useFoodSearch(query: string) {
  const deferredQuery = useDeferredValue(query.trim());
  const [state, setState] = useState<{ query: string; results: SearchResults | null; failed: boolean }>({
    query: "",
    results: null,
    failed: false,
  });

  useEffect(() => {
    if (deferredQuery.length < 2) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/foods/search?q=${encodeURIComponent(deferredQuery)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const results = (await response.json()) as SearchResults;
        setState({ query: deferredQuery, results, failed: false });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error);
          setState({ query: deferredQuery, results: null, failed: true });
        }
      }
    }, 150);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [deferredQuery]);

  const isActive = deferredQuery.length >= 2;
  return {
    isActive,
    isLoading: isActive && state.query !== deferredQuery,
    results: isActive && state.query === deferredQuery ? state.results : null,
    failed: isActive && state.query === deferredQuery && state.failed,
  };
}
