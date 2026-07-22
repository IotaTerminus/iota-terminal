import { NAV_ITEMS } from '@iota/content';

/**
 * Embedded terminal panel: a persistent, revealable/hideable panel docked to
 * the right edge of the viewport, supporting a very limited command set.
 * Framework-agnostic Custom Element (light DOM, same pattern as IotaCursor /
 * IotaWindow) so React and Angular share identical behavior.
 *
 * Panel push (not overlay) is done globally via a class on <html>
 * (`iota-terminal-open`) so the app shell doesn't need per-framework layout
 * glue — see the matching rule in shared/styles/styles.css.
 *
 * `cd` can't call into React Router / Angular Router directly (this element
 * lives outside either framework's tree), so it dispatches a bubbling
 * `iota-terminal:navigate` CustomEvent on `document` that each app's root
 * listens for and forwards to its own router.
 *
 * `iota-be` / `iota-theme` write directly to the same localStorage keys
 * already used by each app's `backend.ts` (`active_backend`) and a new
 * `active_theme` key, then reload the page so any already-mounted
 * components pick up the change — this mirrors the "duplicated in spirit,
 * not shared as a package" contract documented in backend.ts.
 */

type BackendId = 'go' | 'rust' | 'ts';
type FrontendId = 'react' | 'angular';

const BACKEND_STORAGE_KEY = 'active_backend';
const THEME_STORAGE_KEY = 'active_theme';
const OPEN_STORAGE_KEY = 'iota_terminal_open';
const HTML_OPEN_CLASS = 'iota-terminal-open';

const BACKEND_IDS: BackendId[] = ['go', 'rust', 'ts'];
const FRONTEND_IDS: FrontendId[] = ['react', 'angular'];

const HELP_LINES = [
  'available commands:',
  'cd <page>',
  '\tnavigate to a page (e.g. "cd about" or "cd projects")',
  'iota-be <go|rust|ts>',
  '\tswitch active backend (reloads)',
  'iota-fe <react|angular>',
  '\tswitch active frontend (redirects)',
  'iota-theme <name>',
  '\tset active theme (only "dark" implemented today)',
  'help',
  '\tshow this message',
  'clear',
  '\tclears the scrollback'
];

function isBackendId(value: string): value is BackendId {
  return (BACKEND_IDS as string[]).includes(value);
}

function isFrontendId(value: string): value is FrontendId {
  return (FRONTEND_IDS as string[]).includes(value);
}

function resolveNavPath(arg: string): string | null {
  const query = arg.trim().toLowerCase();
  if (!query) return null;
  const match =
    NAV_ITEMS.find((item) => item.label.toLowerCase() === query) ??
    NAV_ITEMS.find((item) => item.id.toLowerCase() === query) ??
    NAV_ITEMS.find((item) => item.path.toLowerCase() === query);
  return match ? `/${match.path}` : null;
}

/**
 * Resolves the sibling frontend's origin for `iota-fe`, or null if we're
 * already on the requested frontend or can't determine a sibling for the
 * current host. Handles both production subdomains and local dev ports.
 */
function resolveSiblingOrigin(target: FrontendId): string | null {
  const { hostname, port, protocol } = window.location;

  if (hostname === 'react.iotaterminus.dev' || hostname === 'angular.iotaterminus.dev') {
    const currentFrontend: FrontendId = hostname === 'react.iotaterminus.dev' ? 'react' : 'angular';
    if (currentFrontend === target) return null;
    return `${protocol}//${target}.iotaterminus.dev`;
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const reactPort = '5173';
    const angularPort = '4200';
    const currentFrontend: FrontendId | null =
      port === reactPort ? 'react' : port === angularPort ? 'angular' : null;
    if (currentFrontend === target) return null;
    const targetPort = target === 'react' ? reactPort : angularPort;
    return `${protocol}//${hostname}:${targetPort}`;
  }

  return null;
}

export class IotaTerminal extends HTMLElement {
  private handleEl: HTMLButtonElement | null = null;
  private panelEl: HTMLDivElement | null = null;
  private scrollbackEl: HTMLDivElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private open = false;

  connectedCallback() {
    if (this.panelEl) return; // already built

    this.className = 'contents';
    this.open = window.localStorage.getItem(OPEN_STORAGE_KEY) === 'true';

    const handle = document.createElement('button');
    handle.type = 'button';
    handle.setAttribute('aria-label', 'Toggle terminal');
    handle.textContent = '>_';
    handle.className =
      'fixed top-1/2 -translate-y-1/2 z-40 px-1.5 py-3 text-sm font-mono ' +
      'bg-terminal-dim/30 border border-terminal-dim border-r-0 rounded-l-md ' +
      'text-terminal-fg hover:bg-terminal-dim/50 transition-[right]';
    handle.addEventListener('click', () => this.toggle());
    this.handleEl = handle;

    const panel = document.createElement('div');
    panel.className =
      'fixed top-0 right-0 h-full z-30 flex flex-col ' +
      'bg-terminal-bg border-l border-terminal-dim font-mono text-sm ' +
      'transition-transform duration-200 ease-out';
    panel.style.width = 'var(--iota-terminal-width)';

    const header = document.createElement('div');
    header.className = 'px-3 py-2 border-b border-terminal-dim text-terminal-dim shrink-0';
    header.textContent = 'iota-terminal';

    const scrollback = document.createElement('div');
    scrollback.className =
      'flex-1 overflow-y-auto px-3 py-2 space-y-1 whitespace-pre-wrap break-words';
    this.scrollbackEl = scrollback;

    const inputRow = document.createElement('div');
    inputRow.className = 'flex items-center gap-2 px-3 py-2 border-t border-terminal-dim shrink-0';

    const prompt = document.createElement('span');
    prompt.className = 'text-terminal-fg';
    prompt.textContent = '$';

    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Terminal command input');
    input.className = 'flex-1 bg-transparent outline-none text-terminal-fg';
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const value = input.value;
        input.value = '';
        this.runCommand(value);
      }
    });
    this.inputEl = input;

    inputRow.append(prompt, input);
    panel.append(header, scrollback, inputRow);
    this.panelEl = panel;

    this.append(handle, panel);
    this.printLine('welcome to iota-terminal. type "help" to see available commands.');
    this.syncOpenState();
  }

  disconnectedCallback() {
    document.documentElement.classList.remove(HTML_OPEN_CLASS);
  }

  private toggle() {
    this.open = !this.open;
    window.localStorage.setItem(OPEN_STORAGE_KEY, String(this.open));
    this.syncOpenState();
    if (this.open) this.inputEl?.focus();
  }

  private syncOpenState() {
    if (!this.panelEl || !this.handleEl) return;
    document.documentElement.classList.toggle(HTML_OPEN_CLASS, this.open);
    this.panelEl.style.transform = this.open ? 'translateX(0)' : 'translateX(100%)';
    this.handleEl.style.right = this.open ? 'var(--iota-terminal-width)' : '0px';
  }

  private printLine(text: string, cls = 'text-terminal-dim') {
    if (!this.scrollbackEl) return;
    const line = document.createElement('div');
    line.className = cls;
    line.textContent = text;
    this.scrollbackEl.appendChild(line);
    this.scrollbackEl.scrollTop = this.scrollbackEl.scrollHeight;
  }

  private runCommand(raw: string) {
    const trimmed = raw.trim();
    this.printLine(`$ ${trimmed}`, 'text-terminal-fg');
    if (!trimmed) return;

    const [cmd, ...rest] = trimmed.split(/\s+/);
    const arg = rest.join(' ');

    switch (cmd) {
      case 'cd':
        this.runCd(arg);
        break;
      case 'iota-be':
        this.runIotaBe(arg);
        break;
      case 'iota-fe':
        this.runIotaFe(arg);
        break;
      case 'iota-theme':
        this.runIotaTheme(arg);
        break;
      case 'help':
        HELP_LINES.forEach((line) => this.printLine(line));
        break;
      case 'clear':
        if (this.scrollbackEl) this.scrollbackEl.innerHTML = '';
        break;
      default:
        this.printLine(`${cmd}: command not found`, 'text-terminal-red');
    }
  }

  private runCd(arg: string) {
    const path = resolveNavPath(arg);
    if (!path) {
      this.printLine(`cd: no such file or directory: ${arg}`, 'text-terminal-red');
      return;
    }
    this.printLine(`navigating to ${path}`);
    document.dispatchEvent(
      new CustomEvent('iota-terminal:navigate', { detail: { path }, bubbles: true })
    );
  }

  private runIotaBe(arg: string) {
    const backend = arg.trim().toLowerCase();
    if (!isBackendId(backend)) {
      this.printLine(
        `iota-be: unknown backend '${arg}' (expected go, rust, ts)`,
        'text-terminal-red'
      );
      return;
    }
    window.localStorage.setItem(BACKEND_STORAGE_KEY, backend);
    this.printLine(`active backend set to ${backend}, reloading...`);
    window.setTimeout(() => window.location.reload(), 300);
  }

  private runIotaFe(arg: string) {
    const frontend = arg.trim().toLowerCase();
    if (!isFrontendId(frontend)) {
      this.printLine(
        `iota-fe: unknown frontend '${arg}' (expected react, angular)`,
        'text-terminal-red'
      );
      return;
    }
    const origin = resolveSiblingOrigin(frontend);
    if (!origin) {
      this.printLine(
        `iota-fe: already on ${frontend}-ui (or host is unrecognized)`,
        'text-terminal-dim'
      );
      return;
    }
    this.printLine(`switching to ${frontend}-ui, redirecting...`);
    const { pathname, search, hash } = window.location;
    window.setTimeout(() => {
      window.location.href = `${origin}${pathname}${search}${hash}`;
    }, 300);
  }

  private runIotaTheme(arg: string) {
    const theme = arg.trim().toLowerCase();
    if (theme !== 'dark') {
      this.printLine(`iota-theme: '${arg}' not implemented yet`, 'text-terminal-red');
      return;
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    this.printLine(`active theme set to ${theme}, reloading...`);
    window.setTimeout(() => window.location.reload(), 300);
  }
}

export function registerIotaTerminal() {
  if (!customElements.get('iota-terminal')) {
    customElements.define('iota-terminal', IotaTerminal);
  }
}
