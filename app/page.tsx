'use client';

import { Check } from 'lucide-react';
import { Option } from 'effect';
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { AddArticleModal } from './components/AddArticleModal';
import { ArticleLibrary } from './components/ArticleLibrary';
import { Reader } from './components/Reader';
import { ShelfHeader } from './components/ShelfHeader';
import { ShelfSidebar } from './components/ShelfSidebar';
import {
  articleIsVisibleInView,
  getShelfViewCopy,
  syncStatusWithProgress,
  type ShelfView,
} from './lib/article-state';
import { loadArticles, removeReadingProgress, saveArticles, saveReadingProgress } from './lib/storage';
import type { Article, ArticleAccent, ExtractedArticle, ReadingProgress } from './lib/types';

const accents: ArticleAccent[] = ['sage', 'blue', 'coral', 'gold', 'plum'];

export default function HomePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [activeView, setActiveView] = useState<ShelfView>('unread');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [todayLabel, setTodayLabel] = useState('\u00a0');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setArticles(loadArticles());
      setTodayLabel(new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(new Date()));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const commitArticles = useCallback((next: Article[], message?: string) => {
    try {
      saveArticles(next);
      setArticles(next);
      if (message) setToast(message);
    } catch {
      setToast('Your browser storage is full. Remove an article and try again.');
    }
  }, []);

  const updateArticle = useCallback((id: string, change: (article: Article) => Article, message?: string) => {
    setArticles((current) => {
      const next = current.map((article) => article.id === id ? change(article) : article);
      try {
        saveArticles(next);
        if (message) setToast(message);
        return next;
      } catch {
        setToast('Your browser storage is full.');
        return current;
      }
    });
  }, []);

  const visibleArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return articles
      .filter((article) => articleIsVisibleInView(activeView, article))
      .filter((article) => !normalizedQuery || [article.title, article.siteName, article.excerpt]
        .join(' ').toLowerCase().includes(normalizedQuery))
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  }, [activeView, articles, query]);

  const selectedArticle = Option.fromNullishOr(selectedId).pipe(
    Option.flatMap((id) => Option.fromNullishOr(articles.find((article) => article.id === id))),
  );
  const viewCopy = getShelfViewCopy(activeView);
  const libraryEyebrow = query
    ? `${visibleArticles.length} matching results`
    : viewCopy.eyebrow;

  const chooseView = (view: ShelfView) => {
    setActiveView(view);
    setMenuId(null);
  };

  const openArticle = useCallback((article: Article) => {
    if (article.status === 'unread') {
      updateArticle(article.id, (current) => ({
        ...current,
        status: 'reading',
        progress: { ...current.progress, updatedAt: new Date().toISOString() },
      }));
    }
    setSelectedId(article.id);
  }, [updateArticle]);

  const updateProgress = useCallback((id: string, progress: ReadingProgress) => {
    try {
      saveReadingProgress(id, progress);
      setArticles((current) => current.map((article) => article.id === id
        ? {
            ...article,
            progress,
            status: syncStatusWithProgress(article.status, progress.percent),
          }
        : article));
    } catch {
      setToast('Could not save your reading position.');
    }
  }, []);

  const addArticle = (extracted: ExtractedArticle) => {
    const article: Article = {
      ...extracted,
      id: crypto.randomUUID(),
      status: 'unread',
      accent: accents[articles.length % accents.length],
      savedAt: new Date().toISOString(),
      progress: { percent: 0, blockId: null, blockOffset: 0, scrollTop: 0, updatedAt: new Date().toISOString() },
    };
    commitArticles([article, ...articles], 'Article added to your shelf');
    setShowAdd(false);
  };

  const deleteArticle = (article: Article) => {
    if (!window.confirm(`Remove “${article.title}” from your shelf?`)) return;
    removeReadingProgress(article.id);
    commitArticles(articles.filter((item) => item.id !== article.id), 'Article removed');
    setMenuId(null);
  };

  const toggleArticleMenu = (article: Article, event: MouseEvent) => {
    event.stopPropagation();
    setMenuId(menuId === article.id ? null : article.id);
  };

  return (
    <main className="app-shell" onClick={() => menuId && setMenuId(null)}>
      <ShelfSidebar
        activeView={activeView}
        articles={articles}
        onViewChange={chooseView}
      />

      <section className="main-panel">
        <ShelfHeader
          pageTitle={viewCopy.pageTitle}
          query={query}
          todayLabel={todayLabel}
          onAddArticle={() => setShowAdd(true)}
          onQueryChange={setQuery}
        />

        <div className="content-wrap">
          <ArticleLibrary
            articles={visibleArticles}
            emptyMessage={viewCopy.emptyMessage}
            eyebrow={libraryEyebrow}
            menuId={menuId}
            query={query}
            onClearSearch={() => setQuery('')}
            onDelete={deleteArticle}
            onMenu={toggleArticleMenu}
            onOpen={openArticle}
          />
        </div>
      </section>

      {showAdd && <AddArticleModal onClose={() => setShowAdd(false)} onAdd={addArticle} />}
      {Option.match(selectedArticle, {
        onNone: () => null,
        onSome: (article) => (
          <Reader
            article={article}
            onClose={() => setSelectedId(null)}
            onProgress={updateProgress}
          />
        ),
      })}
      {toast && <div className="toast" role="status"><Check size={16} /> {toast}</div>}
    </main>
  );
}
