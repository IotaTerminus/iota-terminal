import type { AboutContent } from '@iota/types';

/**
 * Copy for the "about this site" (iotaterminal) page, describing the
 * boilerplate/monorepo itself rather than its author.
 */
export const ABOUT_SITE: AboutContent = {
  heading: 'about this site',
  paragraphs: [
    'iota-terminal is a terminal-themed personal website and an ongoing ' +
      'work in progress. It is actively being expanded, refactored, and ' +
      'polished over time, so what you see here is intentionally evolving ' +
      'rather than a finished static portfolio.',
    'The project uses a monorepo with two independent frontends (React and ' +
      'Angular) plus three interchangeable backends (Go, Rust, and ' +
      'TypeScript). Each backend implements the same API contract, which ' +
      'lets the UI switch runtime implementations without changing page ' +
      'behavior.',
    "Backend selection is driven by this browser's localStorage " +
      '(active_backend), and requests stay same-origin under /api/<backend>. ' +
      'In local development, the frontend dev servers proxy those routes to ' +
      'the matching backend ports; in production, Cloudflare Tunnel routes ' +
      'the same paths to the correct service.',
    'Both frontends intentionally share core building blocks: one Tailwind ' +
      'theme preset, shared global styles, framework-agnostic content and ' +
      'types packages, and reusable UI built with native Custom Elements. ' +
      'That shared layer keeps copy, visuals, and data contracts aligned ' +
      'while still allowing framework-specific implementation choices.',
    'Deployment is automated to keep iteration fast: GitHub Actions builds ' +
      'and smoke-tests container images, pushes them to GHCR, and a Raspberry ' +
      'Pi runtime stack behind Cloudflare pulls updates with watchtower. In ' +
      'practice, this means new changes can ship continuously as the site ' +
      'keeps growing.'
  ]
};
