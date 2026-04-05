export interface ResearchMeta {
  topic: string;
  slug: string;
  createdAt?: string;
  queryTerms?: string[];
  parentSlug?: string;
  sourceSlug?: string;
  sourceLang?: string;
}

export interface ResearchOverview {
  summary?: string;
  keyFindings?: string[];
  significance?: string;
}

export interface ResearchStatistics {
  totalWebSources?: number;
  totalPapers?: number;
  yearRange?: { min: number; max: number };
  topAuthors?: string[];
}

export interface MapExtension {
  type: 'map';
  locations: { name: string; lat: number; lng: number; description?: string }[];
}

export interface TimelineExtension {
  type: 'timeline';
  events: { date: string; title: string; description?: string }[];
}

export interface TableExtension {
  type: 'table';
  headers: string[];
  rows: string[][];
}

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface ChartExtension {
  type: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'radar' | 'scatter' | 'stackedBar';
  labels: string[];
  data: number[] | ChartSeries[];
}

export interface ProfileExtension {
  type: 'profile';
  name: string;
  image?: string;
  bio?: string;
  links?: { label: string; url: string }[];
}

export type Extension = MapExtension | TimelineExtension | TableExtension | ChartExtension | ProfileExtension;

export interface ResearchCorrection {
  target: string;
  old: string;
  new: string;
  reason: string;
}

export interface ResearchVersion {
  version: number;
  createdAt: string;
  overview?: ResearchOverview;
  keywords?: KeywordEntry[];
  webSources?: WebSource[];
  academicPapers?: AcademicPaper[];
  statistics?: ResearchStatistics;
  extensions?: Record<string, Extension>;
  corrections?: ResearchCorrection[];
}

export interface ResearchData {
  meta: ResearchMeta;
  overview?: ResearchOverview;
  keywords?: KeywordEntry[];
  webSources?: WebSource[];
  academicPapers?: AcademicPaper[];
  statistics?: ResearchStatistics;
  extensions?: Record<string, Extension>;
  versions?: ResearchVersion[];
  [key: string]: unknown;
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
