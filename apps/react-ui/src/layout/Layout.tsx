import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '@iota/content';

/**
 * Shared page chrome: nav bar (driven by @iota/content's NAV_ITEMS, the
 * single source of truth also used by the Angular router/nav) plus the
 * routed page content. Also mounts the embedded <iota-terminal> panel and
 * bridges its `iota-terminal:navigate` CustomEvent to React Router, since
 * the terminal is a framework-agnostic Custom Element that can't call
 * useNavigate() directly.
 */
export default function Layout() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const path = (event as CustomEvent<{ path: string }>).detail?.path;
      if (path) navigate(path);
    };
    document.addEventListener('iota-terminal:navigate', handleNavigate);
    return () => document.removeEventListener('iota-terminal:navigate', handleNavigate);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col gap-6 p-4 md:p-8 max-w-3xl mx-auto">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl">
          iota-terminal <iota-cursor></iota-cursor>
        </h1>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.id}
              to={`/${item.path}`}
              end={item.path === ''}
              className={({ isActive }) =>
                isActive ? 'text-terminal-fg underline' : 'text-terminal-dim hover:text-terminal-fg'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <iota-terminal></iota-terminal>
    </div>
  );
}
