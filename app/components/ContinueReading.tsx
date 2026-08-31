import { BookOpen, ChevronRight } from 'lucide-react';
import type { Article } from '../lib/types';

interface ContinueReadingProps {
  article: Article;
  onOpen: () => void;
  onViewAll: () => void;
}

export function ContinueReading({ article, onOpen, onViewAll }: ContinueReadingProps) {
  const minutesLeft = Math.max(1, Math.ceil(article.readTime * (1 - article.progress.percent / 100)));

  return (
    <section className="continue-section">
      <div className="section-title-row">
        <div><p className="eyebrow">Pick up where you left off</p><h2>Continue reading</h2></div>
        <button className="text-button" onClick={onViewAll}>View all <ChevronRight size={16} /></button>
      </div>

      <article className="continue-card">
        <div className="continue-visual">
          <span className="visual-label">{article.siteName}</span>
          <span className="visual-quote">“{article.excerpt}”</span>
          <span className="visual-orbit" aria-hidden="true" />
        </div>
        <div className="continue-copy">
          <div className="article-meta"><span>{article.siteName}</span><span>•</span><span>{article.readTime} MIN READ</span></div>
          <h3>{article.title}</h3>
          <p>{article.excerpt}</p>
          <div className="progress-copy"><span>{Math.round(article.progress.percent)}% complete</span><span>About {minutesLeft} min left</span></div>
          <div className="progress-track"><span style={{ width: `${article.progress.percent}%` }} /></div>
          <button className="resume-button" onClick={onOpen}><BookOpen size={17} /> Resume reading</button>
        </div>
      </article>
    </section>
  );
}
