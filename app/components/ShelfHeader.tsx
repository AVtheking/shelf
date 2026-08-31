'use client';

import { Moon, Plus, Search, Sun, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

const THEME_STORAGE_KEY = 'shelf:theme';

interface ShelfHeaderProps {
  pageTitle: string;
  query: string;
  todayLabel: string;
  onAddArticle: () => void;
  onQueryChange: (query: string) => void;
}

export function ShelfHeader({ pageTitle, query, todayLabel, onAddArticle, onQueryChange }: ShelfHeaderProps) {
  const searchRef = useRef<HTMLInputElement>(null);

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

  const toggleTheme = () => {
    const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      nextTheme === 'dark' ? '#050505' : '#f7f7f7',
    );
  };

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{todayLabel}</p>
        <h1>{pageTitle}</h1>
      </div>
      <div className="top-actions">
        <label className="search-box">
          <Search size={17} />
          <input ref={searchRef} aria-label="Search saved articles" placeholder="Search your shelf" value={query} onChange={(event) => onQueryChange(event.target.value)} />
          {query ? <button aria-label="Clear search" onClick={() => onQueryChange('')}><X size={14} /></button> : <kbd>⌘ K</kbd>}
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
        <button className="primary-button" onClick={onAddArticle}><Plus size={18} /> Add article</button>
      </div>
    </header>
  );
}
