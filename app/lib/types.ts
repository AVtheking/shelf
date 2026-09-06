export type ArticleStatus = 'unread' | 'reading' | 'finished';

export type ArticleAccent = 'sage' | 'blue' | 'coral' | 'gold' | 'plum';

export interface ReadingProgress {
  percent: number;
  blockId: string | null;
  blockOffset?: number;
  scrollTop: number;
  updatedAt: string;
}

export interface Article {
  id: string;
  url: string;
  title: string;
  excerpt: string;
  content: string;
  byline: string;
  siteName: string;
  readTime: number;
  savedAt: string;
  status: ArticleStatus;
  accent: ArticleAccent;
  progress: ReadingProgress;
}

export interface ExtractedArticle {
  url: string;
  title: string;
  excerpt: string;
  content: string;
  byline: string;
  siteName: string;
  readTime: number;
}
