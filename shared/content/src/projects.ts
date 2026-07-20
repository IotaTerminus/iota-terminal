import type { Project } from '@iota/types';

/**
 * Placeholder project list shown on the Projects page in both frontends.
 * Replace with real projects; keep this the single source so React and
 * Angular never show different content.
 */
export const PROJECTS: Project[] = [
  {
    id: 'iota-terminal',
    title: 'iota-terminal',
    description:
      'A terminal-themed personal website built as an actively evolving ' +
      'monorepo. It pairs two independent frontends (React and Angular) with ' +
      'three interchangeable backend implementations (Go, Rust, and ' +
      'TypeScript) that all expose the same API contract, so behavior stays ' +
      'consistent while runtime stacks can be swapped. Backend choice is ' +
      'driven by localStorage (active_backend), and requests stay same-origin ' +
      'under /api/<backend> in both local and production environments. The ' +
      'frontends share a single Tailwind preset, shared global styles, common ' +
      'content/types packages, and reusable native Custom Elements to keep UI ' +
      'and data contracts aligned across frameworks. Deployment is container ' +
      'based: GitHub Actions builds and smoke-tests images, publishes to GHCR, ' +
      'and a Raspberry Pi stack behind Cloudflare Tunnel auto-updates via ' +
      'watchtower for continuous delivery.',
    technologies: ['TypeScript', 'React', 'Angular', 'Go', 'Rust', 'Tailwind CSS'],
    githubUrl: 'https://github.com/IotaTerminus/iota-terminal'
  },
  {
    id: 'OSRS_GE_PGMP',
    title: 'OSRS GE PGMP',
    description:
      'An ongoing, private Rust learning project that is temporarily paused ' +
      'while I focus on other work, but still actively planned for continued ' +
      'iteration. The goal is to build a real-world Old School RuneScape ' +
      'Grand Exchange price monitor that fetches market data, processes item ' +
      'pricing, stores historical information, and serves it through a web ' +
      'API. The codebase is a multi-crate Rust workspace with binary apps ' +
      '(api_server, ingestor) and shared libraries (common, osrs_client), ' +
      'designed to teach core Rust skills progressively: ownership and ' +
      'borrowing, Result/Option error handling, pattern matching, modules, ' +
      'traits, async/await, JSON serialization with Serde, HTTP integration ' +
      'with Reqwest, and API development with Axum. The roadmap includes ' +
      'database integration (PostgreSQL/SQLite via SQLx), migrations, testing, ' +
      'logging/tracing, rate limiting, concurrent ingestion, and Docker-based ' +
      'deployment, supported by a practical learning workflow built around ' +
      'cargo build/run/check/fmt/clippy/doc/test.',
    technologies: [
      'Rust',
      'Cargo Workspaces',
      'Axum',
      'Tokio',
      'Reqwest',
      'Serde',
      'SQLx',
      'PostgreSQL',
      'SQLite',
      'Docker'
    ],
    githubUrl: 'https://github.com/IotaTerminus/OSRS_GE_PGMP'
  }
];
