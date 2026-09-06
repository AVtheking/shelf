import { Match } from 'effect';
import type { Article, ArticleStatus } from './types';

export type ShelfView = 'unread' | 'reading' | 'finished';

export interface ShelfViewCopy {
  pageTitle: string;
  eyebrow: string;
  emptyMessage: string;
}

export const getShelfViewCopy = Match.type<ShelfView>().pipe(
  Match.when('unread', () => ({
    pageTitle: 'Unread',
    eyebrow: 'Not opened yet',
    emptyMessage: 'New articles you have not opened will appear here.',
  })),
  Match.when('reading', () => ({
    pageTitle: 'Reading',
    eyebrow: 'Currently in progress',
    emptyMessage: 'Open an unread article and it will move here.',
  })),
  Match.when('finished', () => ({
    pageTitle: 'Finished',
    eyebrow: 'Completed reading',
    emptyMessage: 'Articles you complete will appear here.',
  })),
  Match.exhaustive,
);

const articlePredicateForView = Match.type<ShelfView>().pipe(
  Match.when('unread', () => (article: Article) => article.status === 'unread'),
  Match.when('reading', () => (article: Article) => article.status === 'reading'),
  Match.when('finished', () => (article: Article) => article.status === 'finished'),
  Match.exhaustive,
);

export function articleIsVisibleInView(view: ShelfView, article: Article) {
  return articlePredicateForView(view)(article);
}

export function readingStatusFromProgress(
  percent: number,
  fallback: ArticleStatus = 'unread',
): ArticleStatus {
  return Match.value(percent).pipe(
    Match.when((value) => value >= 98, () => 'finished' as const),
    Match.when((value) => value > 0, () => 'reading' as const),
    Match.orElse(() => fallback),
  );
}

export function syncStatusWithProgress(status: ArticleStatus, percent: number): ArticleStatus {
  return readingStatusFromProgress(percent, status);
}

export function migrateStoredStatus(status: ArticleStatus | 'archived', percent: number): ArticleStatus {
  return Match.value(status).pipe(
    Match.when('archived', () => readingStatusFromProgress(percent)),
    Match.orElse((current) => readingStatusFromProgress(percent, current)),
  );
}
