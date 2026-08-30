import type { Article, ReadingProgress } from './types';

const ARTICLES_KEY = 'shelf:articles:v1';
const PROGRESS_PREFIX = 'shelf:progress:v1:';
const ASCII_ART_PATTERN = /[┌┐└┘│─╔╗╚╝═║▲▼◐○]/;

function normalizeArticleContent(content: string) {
  if (typeof DOMParser === 'undefined' || !content.includes('<pre')) return content;

  const document = new DOMParser().parseFromString(content, 'text/html');
  const preformattedBlocks = Array.from(document.body.querySelectorAll('pre'));

  preformattedBlocks.forEach((block) => {
    if (ASCII_ART_PATTERN.test(block.textContent ?? '')) {
      block.setAttribute('data-reader-ascii', 'true');
    }
  });

  Array.from(document.body.querySelectorAll('div')).forEach((container) => {
    const children = Array.from(container.children);

    for (let index = 0; index < children.length - 1; index += 1) {
      const wide = children[index];
      const narrow = children[index + 1];
      if (wide.tagName !== 'PRE' || narrow.tagName !== 'PRE') continue;
      if (wide.hasAttribute('data-reader-variant') || narrow.hasAttribute('data-reader-variant')) continue;

      const wideLines = (wide.textContent ?? '').trimStart().split('\n');
      const narrowLines = (narrow.textContent ?? '').trimStart().split('\n');
      const wideHeading = wideLines[0]?.trim();
      const narrowHeading = narrowLines[0]?.trim();
      const wideWidth = Math.max(0, ...wideLines.map((line) => line.length));
      const narrowWidth = Math.max(0, ...narrowLines.map((line) => line.length));

      if (wideHeading && wideHeading === narrowHeading && wideWidth > narrowWidth + 12) {
        wide.setAttribute('data-reader-variant', 'wide');
        narrow.setAttribute('data-reader-variant', 'narrow');
        index += 1;
      }
    }
  });

  return document.body.innerHTML;
}

function progressKey(articleId: string) {
  return `${PROGRESS_PREFIX}${articleId}`;
}

export function loadReadingProgress(articleId: string): ReadingProgress | null {
  if (typeof window === 'undefined') return null;

  try {
    const value = window.localStorage.getItem(progressKey(articleId));
    if (!value) return null;
    const progress = JSON.parse(value) as ReadingProgress;
    return typeof progress.percent === 'number' ? progress : null;
  } catch {
    return null;
  }
}

export function saveReadingProgress(articleId: string, progress: ReadingProgress) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(progressKey(articleId), JSON.stringify(progress));
}

export function removeReadingProgress(articleId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(progressKey(articleId));
}

export function loadArticles(): Article[] {
  if (typeof window === 'undefined') return [];

  const value = window.localStorage.getItem(ARTICLES_KEY);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as Array<Article & { category?: string }>;
    if (!Array.isArray(parsed)) return [];

    const articles = parsed
      .filter((article) => !article.id.startsWith('demo-'))
      .map((article) => {
        const migrated = { ...article };
        delete migrated.category;
        migrated.content = normalizeArticleContent(migrated.content);
        const progress = loadReadingProgress(migrated.id) ?? migrated.progress;
        const status = migrated.status === 'archived'
          ? 'archived'
          : progress.percent >= 98
            ? 'finished'
            : progress.percent > 0
              ? 'reading'
              : migrated.status;
        return { ...migrated, progress, status } as Article;
      });

    saveArticles(articles);
    return articles;
  } catch {
    return [];
  }
}

export function saveArticles(articles: Article[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ARTICLES_KEY, JSON.stringify(articles));
}
