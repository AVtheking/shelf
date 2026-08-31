import { Archive, Bookmark, Heart, Home, Library, Sparkles } from 'lucide-react';
import type { ShelfView } from '../lib/article-state';

interface ShelfSidebarProps {
  activeView: ShelfView;
  articleCount: number;
  onViewChange: (view: ShelfView) => void;
}

export function ShelfSidebar({ activeView, articleCount, onViewChange }: ShelfSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark"><Bookmark size={18} strokeWidth={2.5} /></span>
        <span>Shelf</span>
      </div>

      <nav className="side-nav" aria-label="Main navigation">
        <button className={`nav-item ${activeView === 'home' ? 'active' : ''}`} onClick={() => onViewChange('home')}><Home size={18} /> <b>Home</b></button>
        <button className={`nav-item ${activeView === 'all' ? 'active' : ''}`} onClick={() => onViewChange('all')}><Library size={18} /> <b>All articles</b><span>{articleCount}</span></button>
        <button className={`nav-item ${activeView === 'favorites' ? 'active' : ''}`} onClick={() => onViewChange('favorites')}><Heart size={18} /> <b>Favorites</b></button>
        <button className={`nav-item ${activeView === 'archive' ? 'active' : ''}`} onClick={() => onViewChange('archive')}><Archive size={18} /> <b>Archive</b></button>
      </nav>

      <div className="local-note">
        <Sparkles size={16} />
        <div><strong>Private by design</strong><p>Saved only on this device</p></div>
      </div>
    </aside>
  );
}
