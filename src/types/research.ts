export interface ResearchData {
  meta: {
    topic: string;
    slug: string;
    createdAt: string;
    queryTerms: string[];
  };
  overview: {
    summary: string;
    keyFindings: string[];
    significance: string;
  };
  keywords: KeywordEntry[];
  webSources: WebSource[];
  academicPapers: AcademicPaper[];
  statistics: {
    totalWebSources: number;
    totalPapers: number;
    yearRange: { min: number; max: number };
    topAuthors: string[];
  };
}

export interface KeywordEntry {
  term: string;
  relevance: number;
  category: 'method' | 'concept' | 'technology' | 'entity' | 'outcome';
  relatedTerms: string[];
}

export interface WebSource {
  title: string;
  url: string;
  snippet: string;
  sourceType: 'news' | 'blog' | 'organization' | 'government' | 'encyclopedia' | 'other';
  retrievedAt: string;
}

export interface OchiaiSummary {
  what: string;
  novelty: string;
  method: string;
  validation: string;
  discussion: string;
  next: string;
}

export interface AcademicPaper {
  paperId: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string | null;
  url: string;
  citationCount: number;
  openAccessPdfUrl: string | null;
  venue: string | null;
  ochiaiSummary?: OchiaiSummary;
}

export interface TopicEntry {
  slug: string;
  topic: string;
  createdAt: string;
}

export interface TopicIndex {
  topics: TopicEntry[];
}
