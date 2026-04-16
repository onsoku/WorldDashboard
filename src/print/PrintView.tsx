import { useEffect, useState } from 'react';
import type { ResearchData } from '@/types/research';
import { StatsBar } from '@/components/StatsBar';
import { ThemeOverview } from '@/components/ThemeOverview';
import { KeywordMap } from '@/components/KeywordMap';
import { SourceList } from '@/components/SourceList';
import { ExtensionRenderer } from '@/components/ExtensionRenderer';

/**
 * Print-only view that renders one or more topics stacked with page breaks.
 * Puppeteer (or the user's browser print dialog) targets this route to produce a PDF.
 *
 * Signals readiness via `window.__PRINT_READY__ = true` once every topic's data
 * has been fetched and rendered, so the PDF generator knows when to capture.
 */
export function PrintView() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('slugs') ?? '';
  const slugs = raw.split(',').map(s => s.trim()).filter(Boolean);

  const [topics, setTopics] = useState<ResearchData[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const results = await Promise.all(slugs.map(async slug => {
          const res = await fetch(`/data/${slug}.json`);
          if (!res.ok) throw new Error(`Failed to load ${slug}`);
          return (await res.json()) as ResearchData;
        }));
        if (!cancelled) setTopics(results);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }
    if (slugs.length === 0) {
      setError('No slugs specified');
    } else {
      load();
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (topics && !error) {
      // Give recharts/leaflet a moment to paint before signaling ready.
      const id = window.setTimeout(() => {
        (window as unknown as { __PRINT_READY__: boolean }).__PRINT_READY__ = true;
        document.title = topics.length === 1
          ? topics[0].meta.topic
          : `Encyclopedia (${topics.length} topics)`;
      }, 800);
      return () => window.clearTimeout(id);
    }
  }, [topics, error]);

  if (error) {
    return <div style={{ padding: 24, color: 'red' }}>Print error: {error}</div>;
  }
  if (!topics) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  return (
    <div className="print-root theme-bg theme-text">
      {topics.map((data, i) => (
        <article
          key={data.meta.slug}
          className="print-topic"
          style={{ pageBreakAfter: i < topics.length - 1 ? 'always' : 'auto' }}
        >
          <header className="print-topic-header">
            <h1 className="print-topic-title">{data.meta.topic}</h1>
            {data.meta.createdAt && (
              <p className="print-topic-meta">
                {new Date(data.meta.createdAt).toLocaleDateString()}
              </p>
            )}
          </header>
          <div className="print-topic-body space-y-6">
            {data.statistics && (
              <StatsBar statistics={data.statistics} keywordCount={data.keywords?.length ?? 0} />
            )}
            {data.overview && <ThemeOverview overview={data.overview} />}
            {data.keywords && data.keywords.length > 0 && (
              <KeywordMap keywords={data.keywords} />
            )}
            {data.extensions && Object.keys(data.extensions).length > 0 && (
              <ExtensionRenderer extensions={data.extensions} />
            )}
            {((data.webSources && data.webSources.length > 0) ||
              (data.academicPapers && data.academicPapers.length > 0)) && (
              <SourceList
                webSources={data.webSources ?? []}
                academicPapers={data.academicPapers ?? []}
              />
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
