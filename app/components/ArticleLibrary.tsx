import { BookOpen, Plus, X } from 'lucide-react';
import type { MouseEvent } from 'react';
import type { Article } from '../lib/types';
import { ArticleCard } from './ArticleCard';

interface ArticleLibraryProps {
  articles: Article[];
  emptyMessage: string;
  eyebrow: string;
  menuId: string | null;
  query: string;
  title: string;
  onAddArticle: () => void;
  onClearSearch: () => void;
  onDelete: (article: Article) => void;
  onMenu: (article: Article, event: MouseEvent) => void;
  onOpen: (article: Article) => void;
}

export function ArticleLibrary({
  articles,
  emptyMessage,
  eyebrow,
  menuId,
  query,
  title,
  onAddArticle,
  onClearSearch,
  onDelete,
  onMenu,
  onOpen,
}: ArticleLibraryProps) {
  return (
    <section className="recent-section">
      <div className="section-title-row">
        <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
        {query && <button className="filter-button" onClick={onClearSearch}>Clear search <X size={14} /></button>}
      </div>

      {articles.length ? (
        <div className="article-grid">
          {articles.map((article) => (
            <ArticleCard
              article={article}
              key={article.id}
              menuOpen={menuId === article.id}
              onOpen={() => onOpen(article)}
              onMenu={(event) => onMenu(article, event)}
              onDelete={() => onDelete(article)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span><BookOpen size={24} /></span>
          <h3>Nothing here yet</h3>
          <p>{query ? 'Try a different search.' : emptyMessage}</p>
          {!query && <button className="primary-button" onClick={onAddArticle}><Plus size={17} /> Add article</button>}
        </div>
      )}
    </section>
  );
}
