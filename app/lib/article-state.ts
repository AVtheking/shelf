import { Match } from 'effect';
import type { Article, ArticleStatus } from './types';

export type ShelfView = 'home' | 'all' | 'favorites' | 'archive' | 'unread' | 'reading' | 'finished';

export interface ShelfViewCopy {
  pageTitle: string;
  libraryTitle: string;
  eyebrow: string;
  emptyMessage: string;
}

export const getShelfViewCopy = Match.type<ShelfView>().pipe(
  Match.when('home', () => ({
    pageTitle: 'Your reading shelf',
    libraryTitle: 'Recent additions',
    eyebrow: 'Saved for later',
    emptyMessage: 'Add an article and it will appear on your shelf.',
  })),
  Match.when('all', () => ({
    pageTitle: 'All articles',
    libraryTitle: 'All articles',
    eyebrow: 'Saved for later',
    emptyMessage: 'Add an article and it will appear on your shelf.',
  })),
  Match.when('favorites', () => ({
    pageTitle: 'Favorites',
    libraryTitle: 'Favorites',
    eyebrow: 'Saved for later',
    emptyMessage: 'Favorite an article and it will appear here.',
  })),
  Match.when('archive', () => ({
    pageTitle: 'Archive',
    libraryTitle: 'Archive',
    eyebrow: 'Saved out of sight',
    emptyMessage: 'Archived articles will appear here.',
  })),
  Match.when('unread', () => ({
    pageTitle: 'Unread',
    libraryTitle: 'Unread',
    eyebrow: 'Not opened yet',
    emptyMessage: 'New articles you have not opened will appear here.',
  })),
  Match.when('reading', () => ({
    pageTitle: 'Reading',
    libraryTitle: 'Reading',
    eyebrow: 'Currently in progress',
    emptyMessage: 'Open an unread article and it will move here.',
  })),
  Match.when('finished', () => ({
    pageTitle: 'Finished',
    libraryTitle: 'Finished',
    eyebrow: 'Completed reading',
    emptyMessage: 'Articles you complete will appear here.',
  })),
  Match.exhaustive,
);

const articlePredicateForView = Match.type<ShelfView>().pipe(
  Match.when('favorites', () => (article: Article) => article.favorite && article.status !== 'archived'),
  Match.when('archive', () => (article: Article) => article.status === 'archived'),
  Match.when('unread', () => (article: Article) => article.status === 'unread'),
  Match.when('reading', () => (article: Article) => article.status === 'reading'),
  Match.when('finished', () => (article: Article) => article.status === 'finished'),
  Match.when(Match.is('home', 'all'), () => (article: Article) => article.status !== 'archived'),
  Match.exhaustive,
);

export function articleIsVisibleInView(view: ShelfView, article: Article) {
  return articlePredicateForView(view)(article);
}

export function readingStatusFromProgress(
  percent: number,
  fallback: Exclude<ArticleStatus, 'archived'> = 'unread',
): Exclude<ArticleStatus, 'archived'> {
  return Match.value(percent).pipe(
    Match.when((value) => value >= 98, () => 'finished' as const),
    Match.when((value) => value > 0, () => 'reading' as const),
    Match.orElse(() => fallback),
  );
}

export function syncStatusWithProgress(status: ArticleStatus, percent: number): ArticleStatus {
  return Match.value(status).pipe(
    Match.when('archived', () => 'archived' as const),
    Match.orElse((current) => readingStatusFromProgress(percent, current)),
  );
}
