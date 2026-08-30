'use client';

import {
  Archive,
  ArrowLeft,
  Bookmark,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  Heart,
  Home,
  Library,
  LoaderCircle,
  MoreHorizontal,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { Effect } from 'effect';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchArticleEffect } from './lib/article-client';
import { loadArticles, removeReadingProgress, saveArticles, saveReadingProgress } from './lib/storage';
import type { Article, ArticleAccent, ExtractedArticle, ReadingProgress } from './lib/types';

type View = 'home' | 'all' | 'favorites' | 'archive';

const THEME_STORAGE_KEY = 'shelf:theme';

const accents: ArticleAccent[] = ['sage', 'blue', 'coral', 'gold', 'plum'];

function formatSaved(date: string) {
  const elapsed = Date.now() - new Date(date).getTime();
  const days = Math.floor(elapsed / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export default function HomePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [activeView, setActiveView] = useState<View>('home');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [todayLabel, setTodayLabel] = useState('\u00a0');
  const searchRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const commitArticles = useCallback((next: Article[], message?: string) => {
    try {
      saveArticles(next);
      setArticles(next);
      if (message) setToast(message);
    } catch {
      setToast('Your browser storage is full. Remove an article and try again.');
    }
  }, []);

  const visibleArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return articles
      .filter((article) => {
        if (activeView === 'favorites') return article.favorite && article.status !== 'archived';
        if (activeView === 'archive') return article.status === 'archived';
        return article.status !== 'archived';
      })
      .filter((article) => !normalizedQuery || [article.title, article.siteName, article.excerpt]
        .join(' ').toLowerCase().includes(normalizedQuery))
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  }, [activeView, articles, query]);

  const continueArticle = useMemo(() => articles
    .filter((article) => article.status === 'reading' && article.progress.percent > 0 && article.progress.percent < 98)
    .sort((a, b) => new Date(b.progress.updatedAt).getTime() - new Date(a.progress.updatedAt).getTime())[0], [articles]);

  const selectedArticle = selectedId ? articles.find((article) => article.id === selectedId) ?? null : null;
  const recentArticles = activeView === 'home' && !query
    ? visibleArticles.filter((article) => article.id !== continueArticle?.id).slice(0, 6)
    : visibleArticles;

  const chooseView = (view: View) => {
    setActiveView(view);
    setMenuId(null);
  };

  const toggleTheme = () => {
    const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      nextTheme === 'dark' ? '#050505' : '#f7f7f7',
    );
  };

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

  const updateProgress = useCallback((id: string, progress: ReadingProgress) => {
    try {
      saveReadingProgress(id, progress);
      setArticles((current) => current.map((article) => article.id === id
        ? {
            ...article,
            progress,
            status: article.status === 'archived'
              ? 'archived'
              : progress.percent >= 98
                ? 'finished'
                : progress.percent > 0
                  ? 'reading'
                  : article.status,
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
      favorite: false,
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

  const libraryTitle = activeView === 'favorites'
      ? 'Favorites'
      : activeView === 'archive'
        ? 'Archive'
        : activeView === 'all'
          ? 'All articles'
          : 'Recent additions';

  return (
    <main className="app-shell" onClick={() => menuId && setMenuId(null)}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Bookmark size={18} strokeWidth={2.5} /></span>
          <span>Shelf</span>
        </div>

        <nav className="side-nav" aria-label="Main navigation">
          <button className={`nav-item ${activeView === 'home' ? 'active' : ''}`} onClick={() => chooseView('home')}><Home size={18} /> <b>Home</b></button>
          <button className={`nav-item ${activeView === 'all' ? 'active' : ''}`} onClick={() => chooseView('all')}><Library size={18} /> <b>All articles</b><span>{articles.filter((article) => article.status !== 'archived').length}</span></button>
          <button className={`nav-item ${activeView === 'favorites' ? 'active' : ''}`} onClick={() => chooseView('favorites')}><Heart size={18} /> <b>Favorites</b></button>
          <button className={`nav-item ${activeView === 'archive' ? 'active' : ''}`} onClick={() => chooseView('archive')}><Archive size={18} /> <b>Archive</b></button>
        </nav>

        <div className="local-note">
          <Sparkles size={16} />
          <div><strong>Private by design</strong><p>Saved only on this device</p></div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">{todayLabel}</p>
            <h1>{activeView === 'home' ? 'Your reading shelf' : libraryTitle}</h1>
          </div>
          <div className="top-actions">
            <label className="search-box">
              <Search size={17} />
              <input ref={searchRef} aria-label="Search saved articles" placeholder="Search your shelf" value={query} onChange={(event) => setQuery(event.target.value)} />
              {query ? <button aria-label="Clear search" onClick={() => setQuery('')}><X size={14} /></button> : <kbd>⌘ K</kbd>}
            </label>
            <button
              className="theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              title="Toggle color theme"
            >
              <Sun className="theme-icon theme-icon-sun" size={18} />
              <Moon className="theme-icon theme-icon-moon" size={18} />
            </button>
            <button className="primary-button" onClick={() => setShowAdd(true)}><Plus size={18} /> Add article</button>
          </div>
        </header>

        <div className="content-wrap">
          {activeView === 'home' && !query && continueArticle && (
            <section className="continue-section">
              <div className="section-title-row">
                <div><p className="eyebrow">Pick up where you left off</p><h2>Continue reading</h2></div>
                <button className="text-button" onClick={() => chooseView('all')}>View all <ChevronRight size={16} /></button>
              </div>

              <article className="continue-card">
                <div className="continue-visual">
                  <span className="visual-label">{continueArticle.siteName}</span>
                  <span className="visual-quote">“{continueArticle.excerpt}”</span>
                  <span className="visual-orbit" aria-hidden="true" />
                </div>
                <div className="continue-copy">
                  <div className="article-meta"><span>{continueArticle.siteName}</span><span>•</span><span>{continueArticle.readTime} MIN READ</span></div>
                  <h3>{continueArticle.title}</h3>
                  <p>{continueArticle.excerpt}</p>
                  <div className="progress-copy"><span>{Math.round(continueArticle.progress.percent)}% complete</span><span>About {Math.max(1, Math.ceil(continueArticle.readTime * (1 - continueArticle.progress.percent / 100)))} min left</span></div>
                  <div className="progress-track"><span style={{ width: `${continueArticle.progress.percent}%` }} /></div>
                  <button className="resume-button" onClick={() => setSelectedId(continueArticle.id)}><BookOpen size={17} /> Resume reading</button>
                </div>
              </article>
            </section>
          )}

          <section className="recent-section">
            <div className="section-title-row">
              <div><p className="eyebrow">{activeView === 'archive' ? 'Saved out of sight' : query ? `${visibleArticles.length} matching results` : 'Saved for later'}</p><h2>{libraryTitle}</h2></div>
              {query && <button className="filter-button" onClick={() => setQuery('')}>Clear search <X size={14} /></button>}
            </div>

            {recentArticles.length ? (
              <div className="article-grid">
                {recentArticles.map((article) => (
                  <ArticleCard
                    article={article}
                    key={article.id}
                    menuOpen={menuId === article.id}
                    onOpen={() => setSelectedId(article.id)}
                    onMenu={(event) => { event.stopPropagation(); setMenuId(menuId === article.id ? null : article.id); }}
                    onFavorite={() => updateArticle(article.id, (item) => ({ ...item, favorite: !item.favorite }), article.favorite ? 'Removed from favorites' : 'Added to favorites')}
                    onArchive={() => updateArticle(article.id, (item) => ({ ...item, status: item.status === 'archived' ? 'unread' : 'archived' }), article.status === 'archived' ? 'Returned to your shelf' : 'Article archived')}
                    onDelete={() => deleteArticle(article)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span><BookOpen size={24} /></span>
                <h3>Nothing here yet</h3>
                <p>{query ? 'Try a different search.' : 'Add an article and it will appear on your shelf.'}</p>
                {!query && <button className="primary-button" onClick={() => setShowAdd(true)}><Plus size={17} /> Add article</button>}
              </div>
            )}
          </section>
        </div>
      </section>

      {showAdd && <AddArticleModal onClose={() => setShowAdd(false)} onAdd={addArticle} />}
      {selectedArticle && (
        <Reader
          article={selectedArticle}
          onClose={() => setSelectedId(null)}
          onProgress={updateProgress}
          onToggleFavorite={() => updateArticle(selectedArticle.id, (article) => ({ ...article, favorite: !article.favorite }))}
        />
      )}
      {toast && <div className="toast" role="status"><Check size={16} /> {toast}</div>}
    </main>
  );
}

function ArticleCard({ article, menuOpen, onOpen, onMenu, onFavorite, onArchive, onDelete }: {
  article: Article;
  menuOpen: boolean;
  onOpen: () => void;
  onMenu: (event: React.MouseEvent) => void;
  onFavorite: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="article-card">
      <button className={`article-cover cover-${article.accent}`} onClick={onOpen} aria-label={`Read ${article.title}`}>
        <span>{article.siteName.charAt(0).toUpperCase()}</span>
      </button>
      <button className="card-menu-button" aria-label={`More options for ${article.title}`} onClick={onMenu}><MoreHorizontal size={18} /></button>
      {article.favorite && <span className="favorite-mark" aria-label="Favorite"><Heart size={13} fill="currentColor" /></span>}
      {menuOpen && (
        <div className="card-menu" onClick={(event) => event.stopPropagation()}>
          <button onClick={onFavorite}><Heart size={15} /> {article.favorite ? 'Unfavorite' : 'Favorite'}</button>
          <button onClick={onArchive}><Archive size={15} /> {article.status === 'archived' ? 'Unarchive' : 'Archive'}</button>
          <button className="danger" onClick={onDelete}><Trash2 size={15} /> Remove</button>
        </div>
      )}
      <button className="article-body" onClick={onOpen}>
        <h3>{article.title}</h3>
        <p>{article.siteName}</p>
        {article.progress.percent > 0 && article.status !== 'archived' && (
          <div className="card-progress" aria-label={`${Math.round(article.progress.percent)} percent read`}><span style={{ width: `${article.progress.percent}%` }} /></div>
        )}
        <div className="article-footer"><span><Clock3 size={14} /> {article.readTime} min</span><span>{article.status === 'finished' ? 'Finished' : formatSaved(article.savedAt)}</span></div>
      </button>
    </article>
  );
}

function AddArticleModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (article: ExtractedArticle) => void;
}) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => event.key === 'Escape' && !loading && onClose();
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [loading, onClose]);

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    const controller = new AbortController();
    requestControllerRef.current = controller;
    try {
      const result = await Effect.runPromise(fetchArticleEffect(url), {
        signal: controller.signal,
      });
      onAdd(result);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : 'Could not save that article.');
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !loading && onClose()}>
      <section className="add-modal" role="dialog" aria-modal="true" aria-labelledby="add-title">
        <div className="modal-icon"><Bookmark size={21} /></div>
        <button className="modal-close" aria-label="Close" onClick={onClose} disabled={loading}><X size={18} /></button>
        <p className="eyebrow">New reading</p>
        <h2 id="add-title">Add to your shelf</h2>
        <p className="modal-intro">Paste a public article or blog URL. Shelf will create a clean reading copy on this device.</p>
        <form onSubmit={submit}>
          <label className="form-label" htmlFor="article-url">Article URL</label>
          <div className="url-field"><ExternalLink size={17} /><input id="article-url" type="url" required autoFocus value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/an-interesting-article" /></div>
          {error && <p className="form-error">{error}</p>}
          <button className="submit-button" disabled={loading || !url}>{loading ? <><LoaderCircle className="spin" size={17} /> Making a reading copy…</> : <><Plus size={17} /> Add article</>}</button>
          <p className="form-hint">Some paywalled or JavaScript-only pages may not be readable.</p>
        </form>
      </section>
    </div>
  );
}

function Reader({ article, onClose, onProgress, onToggleFavorite }: {
  article: Article;
  onClose: () => void;
  onProgress: (id: string, progress: ReadingProgress) => void;
  onToggleFavorite: () => void;
}) {
  const readerRef = useRef<HTMLDivElement>(null);
  const initialProgressRef = useRef<ReadingProgress>(article.progress);
  const saveTimerRef = useRef<number | null>(null);
  const latestProgressRef = useRef<ReadingProgress>(article.progress);
  const [percent, setPercent] = useState(article.progress.percent);

  const captureProgress = useCallback(() => {
    const reader = readerRef.current;
    if (!reader) return latestProgressRef.current;

    const readerRect = reader.getBoundingClientRect();
    const anchorTop = readerRect.top + Math.min(140, reader.clientHeight * .25);
    const blocks = Array.from(reader.querySelectorAll<HTMLElement>('[data-reader-block]'));
    let currentBlock = blocks[0] ?? null;

    for (const block of blocks) {
      const rect = block.getBoundingClientRect();
      if (rect.top <= anchorTop) currentBlock = block;
      if (rect.top <= anchorTop && rect.bottom >= anchorTop) {
        currentBlock = block;
        break;
      }
      if (rect.top > anchorTop) break;
    }

    const blockRect = currentBlock?.getBoundingClientRect();
    const available = Math.max(1, reader.scrollHeight - reader.clientHeight);
    const next: ReadingProgress = {
      percent: Math.min(100, Math.max(0, (reader.scrollTop / available) * 100)),
      blockId: currentBlock?.dataset.readerBlock ?? null,
      blockOffset: blockRect ? anchorTop - blockRect.top : 0,
      scrollTop: reader.scrollTop,
      updatedAt: new Date().toISOString(),
    };
    latestProgressRef.current = next;
    return next;
  }, []);

  const persistCurrentPosition = useCallback(() => {
    const next = captureProgress();
    onProgress(article.id, next);
    return next;
  }, [article.id, captureProgress, onProgress]);

  const closeReader = useCallback(() => {
    persistCurrentPosition();
    onClose();
  }, [onClose, persistCurrentPosition]);

  useEffect(() => {
    const reader = readerRef.current;
    if (!reader) return;
    let frame = 0;
    let cancelled = false;
    let restoring = true;
    let userInteracted = false;
    const restoreTimers: number[] = [];
    const initialProgress = initialProgressRef.current;

    const applyRestore = () => {
      if (cancelled || userInteracted) return;
      const target = initialProgress.blockId
        ? reader.querySelector<HTMLElement>(`[data-reader-block="${initialProgress.blockId}"]`)
        : null;

      if (target) {
        const readerRect = reader.getBoundingClientRect();
        const anchorTop = readerRect.top + Math.min(140, reader.clientHeight * .25);
        const desiredTargetTop = anchorTop - (initialProgress.blockOffset ?? 0);
        reader.scrollTop += target.getBoundingClientRect().top - desiredTargetTop;
      } else if (initialProgress.scrollTop) {
        reader.scrollTop = initialProgress.scrollTop;
      } else if (initialProgress.percent) {
        reader.scrollTop = (reader.scrollHeight - reader.clientHeight) * (initialProgress.percent / 100);
      }

      const restored = captureProgress();
      setPercent(restored.percent);
    };

    const restore = async () => {
      await document.fonts.ready;
      if (cancelled) return;
      frame = window.requestAnimationFrame(applyRestore);
      restoreTimers.push(window.setTimeout(applyRestore, 300));
      restoreTimers.push(window.setTimeout(() => {
        applyRestore();
        restoring = false;
      }, 900));
    };

    const handleUserIntent = () => {
      userInteracted = true;
      restoring = false;
    };

    const handleScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = captureProgress();
        setPercent(next.percent);
        if (restoring) return;
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => onProgress(article.id, next), 300);
      });
    };

    const handlePageHide = () => onProgress(article.id, captureProgress());
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') handlePageHide();
    };

    reader.addEventListener('scroll', handleScroll, { passive: true });
    reader.addEventListener('wheel', handleUserIntent, { passive: true });
    reader.addEventListener('touchstart', handleUserIntent, { passive: true });
    reader.addEventListener('pointerdown', handleUserIntent, { passive: true });
    window.addEventListener('keydown', handleUserIntent);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibility);
    void restore();

    return () => {
      cancelled = true;
      reader.removeEventListener('scroll', handleScroll);
      reader.removeEventListener('wheel', handleUserIntent);
      reader.removeEventListener('touchstart', handleUserIntent);
      reader.removeEventListener('pointerdown', handleUserIntent);
      window.removeEventListener('keydown', handleUserIntent);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.cancelAnimationFrame(frame);
      restoreTimers.forEach((timer) => window.clearTimeout(timer));
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      onProgress(article.id, latestProgressRef.current);
    };
  }, [article.id, captureProgress, onProgress]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => event.key === 'Escape' && closeReader();
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [closeReader]);

  const finishArticle = () => {
    const finished = { ...captureProgress(), percent: 100, updatedAt: new Date().toISOString() };
    onProgress(article.id, finished);
    onClose();
  };

  return (
    <section className="reader-overlay" aria-label={`Reading ${article.title}`}>
      <div className="reader-progress-bar"><span style={{ width: `${percent}%` }} /></div>
      <header className="reader-toolbar">
        <button className="round-button" aria-label="Back to shelf" onClick={closeReader}><ArrowLeft size={19} /></button>
        <div className="reader-toolbar-title"><strong>{article.title}</strong><span>{Math.round(percent)}% read</span></div>
        <div className="reader-actions">
          <button className={`round-button ${article.favorite ? 'selected' : ''}`} aria-label={article.favorite ? 'Remove from favorites' : 'Add to favorites'} onClick={onToggleFavorite}><Heart size={18} fill={article.favorite ? 'currentColor' : 'none'} /></button>
          <a className="round-button" href={article.url} target="_blank" rel="noreferrer" aria-label="Open original article"><ExternalLink size={18} /></a>
        </div>
      </header>
      <div className="reader-scroll" ref={readerRef}>
        <article className="reader-article">
          <header className="reader-heading">
            <div className="reader-kicker"><span>{article.siteName}</span><span>{article.readTime} min read</span></div>
            <h1>{article.title}</h1>
            {article.excerpt && <p>{article.excerpt}</p>}
            {article.byline && <div className="reader-byline"><span>{article.byline.charAt(0).toUpperCase()}</span><div><small>Written by</small><strong>{article.byline}</strong></div></div>}
          </header>
          <div className="reader-content" dangerouslySetInnerHTML={{ __html: article.content }} />
          <footer className="reader-end">
            <span><Check size={23} /></span>
            <h2>You reached the end</h2>
            <p>Mark this article as finished and return to your shelf.</p>
            <button className="submit-button" onClick={finishArticle}><Check size={17} /> Mark as finished</button>
          </footer>
        </article>
      </div>
    </section>
  );
}
