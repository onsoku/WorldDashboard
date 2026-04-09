import { useState, useEffect, useCallback } from 'react';
import type { ResearchData, TopicEntry } from '@/types/research';

export function useResearchData() {
  const [topics, setTopics] = useState<TopicEntry[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [currentData, setCurrentData] = useState<ResearchData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTopics = useCallback(async () => {
    try {
      const res = await fetch('/data/index.json');
      if (!res.ok) throw new Error('トピック一覧の読み込みに失敗しました');
      const data = await res.json();
      setTopics(data.topics ?? []);
    } catch (e) {
      setTopics([]);
      setError(e instanceof Error ? e.message : 'トピック一覧の読み込みエラー');
    }
  }, []);

  const selectTopic = useCallback(async (slug: string) => {
    setSelectedSlug(slug);
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/data/${slug}.json`);
      if (!res.ok) throw new Error(`トピック "${slug}" のデータが見つかりません`);
      const text = await res.text();
      let data: ResearchData;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        const msg = parseErr instanceof SyntaxError ? parseErr.message : String(parseErr);
        throw new Error(`JSONパースエラー (${slug}.json): ${msg}`);
      }
      if (!data?.meta?.topic || !data?.meta?.slug) {
        throw new Error(`無効なデータ: meta.topic と meta.slug は必須です`);
      }
      setCurrentData(data);
    } catch (e) {
      setCurrentData(null);
      setError(e instanceof Error ? e.message : 'データ読み込みエラー');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshTopics();
  }, [refreshTopics]);

  const deleteTopic = useCallback(async (slug: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/topic/${encodeURIComponent(slug)}`, { method: 'DELETE' });
      if (!res.ok) return false;
      if (selectedSlug === slug) {
        setSelectedSlug(null);
        setCurrentData(null);
        setError(null);
      }
      await refreshTopics();
      return true;
    } catch {
      return false;
    }
  }, [selectedSlug, refreshTopics]);

  const repairTopic = useCallback(async (slug: string): Promise<'repaired' | 'already_valid' | 'unrepairable' | 'error'> => {
    try {
      const res = await fetch(`/api/repair/${encodeURIComponent(slug)}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        await selectTopic(slug);
        return data.status;
      }
      return data.status ?? 'error';
    } catch {
      return 'error';
    }
  }, [selectTopic]);

  useEffect(() => {
    if (topics.length > 0 && !selectedSlug) {
      selectTopic(topics[0].slug);
    }
  }, [topics, selectedSlug, selectTopic]);

  return {
    topics,
    selectedSlug,
    currentData,
    isLoading,
    error,
    refreshTopics,
    selectTopic,
    deleteTopic,
    repairTopic,
  };
}
