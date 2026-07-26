import { describe, it, expect } from 'vitest'
import { detectContentLang } from './detectContentLang'
import type { ResearchData } from '@/types/research'

const withSummary = (summary: string): ResearchData =>
  ({ meta: { topic: 't', slug: 's' }, overview: { summary } }) as ResearchData

describe('detectContentLang', () => {
  it('detects Japanese from kana', () => {
    expect(detectContentLang(withSummary(
      '\u91cf\u5b50\u30b3\u30f3\u30d4\u30e5\u30fc\u30bf\u306f\u3001\u91cf\u5b50\u529b\u5b66\u306e\u539f\u7406\u3092\u5229\u7528\u3057\u305f\u8a08\u7b97\u6a5f\u3067\u3059\u3002',
    ))).toBe('ja')
  })

  it('detects Chinese from ideographs without kana', () => {
    expect(detectContentLang(withSummary(
      '\u91cf\u5b50\u8ba1\u7b97\u673a\u662f\u5229\u7528\u91cf\u5b50\u529b\u5b66\u539f\u7406\u8fdb\u884c\u8ba1\u7b97\u7684\u673a\u5668\u3002',
    ))).toBe('zh')
  })

  it('detects English', () => {
    expect(detectContentLang(withSummary(
      'Quantum computing is the use of quantum mechanics in the field of computation.',
    ))).toBe('en')
  })

  it('detects Spanish', () => {
    expect(detectContentLang(withSummary(
      'La computacion cuantica es el uso de los principios cuanticos.',
    ))).toBe('es')
  })

  it('detects French', () => {
    expect(detectContentLang(withSummary(
      "L'informatique quantique est le domaine des sciences qui utilise les principes.",
    ))).toBe('fr')
  })

  it('detects Italian', () => {
    expect(detectContentLang(withSummary(
      'Il calcolo quantistico di che si occupa dei principi quantistici.',
    ))).toBe('it')
  })

  it('falls back to keyFindings when there is no summary', () => {
    const data = {
      meta: { topic: 't', slug: 's' },
      overview: { keyFindings: ['This is the first finding of the study.'] },
    } as ResearchData
    expect(detectContentLang(data)).toBe('en')
  })

  it('returns undefined when there is no overview text at all', () => {
    expect(detectContentLang({ meta: { topic: 't', slug: 's' } } as ResearchData)).toBeUndefined()
    expect(detectContentLang(withSummary(''))).toBeUndefined()
  })

  it('returns undefined for text with no usable signal', () => {
    expect(detectContentLang(withSummary('12345 67890 !!! ???'))).toBeUndefined()
  })

  it('prefers Japanese over Chinese when kana are present in a CJK-heavy text', () => {
    expect(detectContentLang(withSummary(
      '\u6f22\u5b57\u304c\u591a\u3044\u6587\u7ae0\u3067\u3059\u304c\u3001\u304b\u306a\u3082\u542b\u307e\u308c\u307e\u3059\u3002',
    ))).toBe('ja')
  })

  it('does not claim CJK for a stray ideograph in mostly-Latin text', () => {
    const latin = 'This paper compares approaches across many different systems and workloads. '.repeat(3)
    expect(detectContentLang(withSummary(latin + '\u91cf'))).toBe('en')
  })
})
