'use client';

import { Bookmark, ExternalLink, LoaderCircle, Plus, X } from 'lucide-react';
import { Effect, Match } from 'effect';
import { useEffect, useRef, useState } from 'react';
import { fetchArticleEffect } from '../lib/article-client';
import type { ExtractedArticle } from '../lib/types';

interface AddArticleModalProps {
  onAdd: (article: ExtractedArticle) => void;
  onClose: () => void;
}

export function AddArticleModal({ onClose, onAdd }: AddArticleModalProps) {
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
      setError(Match.value(caught).pipe(
        Match.when(Match.instanceOf(Error), (error) => error.message),
        Match.orElse(() => 'Could not save that article.'),
      ));
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
