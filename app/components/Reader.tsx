'use client';

import { ArrowLeft, Check, ExternalLink } from 'lucide-react';
import { Option } from 'effect';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Article, ReadingProgress } from '../lib/types';

interface ReaderProps {
  article: Article;
  onClose: () => void;
  onProgress: (id: string, progress: ReadingProgress) => void;
}

export function Reader({ article, onClose, onProgress }: ReaderProps) {
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
      const target = Option.fromNullishOr(initialProgress.blockId).pipe(
        Option.flatMap((blockId) => Option.fromNullishOr(
          reader.querySelector<HTMLElement>(`[data-reader-block="${blockId}"]`),
        )),
      );

      Option.match(target, {
        onNone: () => {
          if (initialProgress.scrollTop) {
            reader.scrollTop = initialProgress.scrollTop;
          } else if (initialProgress.percent) {
            reader.scrollTop = (reader.scrollHeight - reader.clientHeight) * (initialProgress.percent / 100);
          }
        },
        onSome: (target) => {
          const readerRect = reader.getBoundingClientRect();
          const anchorTop = readerRect.top + Math.min(140, reader.clientHeight * .25);
          const desiredTargetTop = anchorTop - (initialProgress.blockOffset ?? 0);
          reader.scrollTop += target.getBoundingClientRect().top - desiredTargetTop;
        },
      });

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
