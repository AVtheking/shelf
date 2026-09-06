import { BookOpen, Bookmark, CheckCircle2, Circle } from 'lucide-react';
import type { ShelfView } from '../lib/article-state';
import type { Article } from '../lib/types';

interface ShelfSidebarProps {
  activeView: ShelfView;
  articles: Article[];
  onViewChange: (view: ShelfView) => void;
}

export function ShelfSidebar({ activeView, articles, onViewChange }: ShelfSidebarProps) {
  const unreadCount = articles.filter((article) => article.status === 'unread').length;
  const readingCount = articles.filter((article) => article.status === 'reading').length;
  const finishedCount = articles.filter((article) => article.status === 'finished').length;

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark"><Bookmark size={18} strokeWidth={2.5} /></span>
        <span>Shelf</span>
      </div>

      <nav className="side-nav" aria-label="Main navigation">
        <button className={`nav-item ${activeView === 'unread' ? 'active' : ''}`} onClick={() => onViewChange('unread')}><Circle size={18} /> <b>Unread</b><span>{unreadCount}</span></button>
        <button className={`nav-item ${activeView === 'reading' ? 'active' : ''}`} onClick={() => onViewChange('reading')}><BookOpen size={18} /> <b>Reading</b><span>{readingCount}</span></button>
        <button className={`nav-item ${activeView === 'finished' ? 'active' : ''}`} onClick={() => onViewChange('finished')}><CheckCircle2 size={18} /> <b>Finished</b><span>{finishedCount}</span></button>
      </nav>
    </aside>
  );
}
