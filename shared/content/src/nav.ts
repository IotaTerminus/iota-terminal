import type { NavItem } from '@iota/types';

/**
 * Single source of truth for site navigation, consumed by both frontends'
 * routers and nav bars so route paths/labels never drift between them.
 * `path` is relative (no leading slash) and matches the React Router /
 * Angular Router route path exactly.
 */
export const NAV_ITEMS: NavItem[] = [
  { id: 'home', path: '', label: 'home' },
  { id: 'about-me', path: 'about', label: 'whoami' },
  { id: 'about-site', path: 'stack', label: 'cat README.md' },
  { id: 'projects', path: 'projects', label: 'ls projects/' },
  { id: 'resume', path: 'resume', label: 'cat resume.md' },
  { id: 'contact', path: 'contact', label: 'contact --me' }
];
