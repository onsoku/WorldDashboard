import type { ResearchData } from '@/types/research';

/**
 * Detect content language from overview text when meta.lang is not set.
 *
 * Topics created before meta.lang existed have no recorded language, and the
 * translate dialog needs one to filter out the source language. Returns
 * undefined when there is not enough signal to decide.
 */
export function detectContentLang(data: ResearchData): string | undefined {
  const text = data.overview?.summary ?? data.overview?.keyFindings?.[0] ?? '';
  if (!text) return undefined;
  // CJK character ranges: ideographs / kana / hangul
  const cjk = text.match(/[\u3000-\u9fff\uf900-\ufaff]/g)?.length ?? 0;
  const kana = text.match(/[\u3040-\u309f\u30a0-\u30ff]/g)?.length ?? 0;
  const total = text.length;
  if (total === 0) return undefined;
  if (kana > 0 && (cjk + kana) / total > 0.1) return 'ja';
  if (cjk / total > 0.1) return 'zh';
  // Latin-script heuristics via common words
  const lower = text.toLowerCase();
  if (/\b(the|and|is|of|in)\b/.test(lower)) return 'en';
  if (/\b(el|la|los|las|es|de|en)\b/.test(lower)) return 'es';
  if (/\b(le|la|les|des|est|et)\b/.test(lower)) return 'fr';
  if (/\b(il|la|le|di|che|\u00e8)\b/.test(lower)) return 'it';
  return undefined;
}
