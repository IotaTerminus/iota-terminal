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
  { id: 'about-site', path: 'stack', label: 'README.md' },
  { id: 'projects', path: 'projects', label: 'projects' },
  { id: 'resume', path: 'resume', label: 'resume' },
  { id: 'guestbook', path: 'guestbook', label: 'guestbook' }
  // TODO - re-enable contact page
  // { id: 'contact', path: 'contact', label: 'contact --me' },
];
