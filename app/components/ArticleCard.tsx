import { Archive, Clock3, Heart, MoreHorizontal, Trash2 } from 'lucide-react';
import { Match } from 'effect';
import type { MouseEvent } from 'react';
import type { Article } from '../lib/types';

interface ArticleCardProps {
  article: Article;
  menuOpen: boolean;
  onArchive: () => void;
  onDelete: () => void;
  onFavorite: () => void;
  onMenu: (event: MouseEvent) => void;
  onOpen: () => void;
}

function formatSaved(date: string) {
  const elapsed = Date.now() - new Date(date).getTime();
  const days = Math.floor(elapsed / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export function ArticleCard({ article, menuOpen, onOpen, onMenu, onFavorite, onArchive, onDelete }: ArticleCardProps) {
  const readingLabel = Match.value(article.progress.percent).pipe(
    Match.when((percent) => percent > 0, (percent) => `${Math.round(percent)}% read`),
    Match.orElse(() => 'Started'),
  );
  const statusLabel = Match.value(article.status).pipe(
    Match.when('finished', () => 'Finished'),
    Match.when('reading', () => readingLabel),
    Match.when(Match.is('unread', 'archived'), () => formatSaved(article.savedAt)),
    Match.exhaustive,
  );

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
        <div className="article-footer">
          <span><Clock3 size={14} /> {article.readTime} min</span>
          <span>{statusLabel}</span>
        </div>
      </button>
    </article>
  );
}
