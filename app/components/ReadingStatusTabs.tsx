import { BookOpen, CheckCircle2, Circle } from 'lucide-react';
import type { ShelfView } from '../lib/article-state';
import type { Article } from '../lib/types';

interface ReadingStatusTabsProps {
  activeView: ShelfView;
  articles: Article[];
  onViewChange: (view: ShelfView) => void;
}

export function ReadingStatusTabs({ activeView, articles, onViewChange }: ReadingStatusTabsProps) {
  const unreadCount = articles.filter((article) => article.status === 'unread').length;
  const readingCount = articles.filter((article) => article.status === 'reading').length;
  const finishedCount = articles.filter((article) => article.status === 'finished').length;

  return (
    <nav className="status-tabs" aria-label="Reading status">
      <button className={`status-tab ${activeView === 'unread' ? 'active' : ''}`} onClick={() => onViewChange('unread')}>
        <Circle size={15} />
        <b>Unread</b>
        <span>{unreadCount}</span>
      </button>
      <button className={`status-tab ${activeView === 'reading' ? 'active' : ''}`} onClick={() => onViewChange('reading')}>
        <BookOpen size={15} />
        <b>Reading</b>
        <span>{readingCount}</span>
      </button>
      <button className={`status-tab ${activeView === 'finished' ? 'active' : ''}`} onClick={() => onViewChange('finished')}>
        <CheckCircle2 size={15} />
        <b>Finished</b>
        <span>{finishedCount}</span>
      </button>
    </nav>
  );
}
