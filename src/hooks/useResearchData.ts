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
      const data: ResearchData = await res.json();
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
  };
}
