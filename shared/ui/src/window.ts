/**
 * Terminal-window chrome: a bordered box with a title bar (traffic-light
 * dots + optional title) wrapping page content. Framework-agnostic Custom
 * Element so React and Angular render identical markup without either one
 * owning the implementation. No shadow DOM (see IotaCursor) — content stays
 * in the light DOM so the global Tailwind stylesheet still applies to it.
 *
 * Usage: <iota-window title="whoami">...content...</iota-window>
 * The `title` attribute is reactive (see the insertion-order gotcha below).
 *
 * Insertion-order gotcha: React builds the whole subtree off-document
 * before attaching it, so light-DOM children (and any bound attributes)
 * already exist by the time connectedCallback runs. Angular's renderer
 * instead attaches this element to the document first and applies
 * projected children *and* attribute bindings (e.g. `[attr.title]`)
 * afterward, so connectedCallback can fire before either exists. Reading
 * `innerHTML`/`getAttribute('title')` synchronously and only once on
 * connect (as an earlier version of this file did) silently drops content
 * or the title under Angular while appearing to work under React — this
 * bit us for real with `about-me.component.ts`, the only page using a
 * dynamic `[attr.title]` binding instead of a static `title="..."`. To stay
 * agnostic to that ordering we: (1) move whatever children are present at
 * connect time into the content wrapper, then use a MutationObserver to
 * catch any appended afterward; (2) treat `title` as an observed attribute
 * and re-render it via attributeChangedCallback whenever it changes,
 * including changes that land after connectedCallback has already run.
 */
export class IotaWindow extends HTMLElement {
  static get observedAttributes() {
    return ['title'];
  }

  private contentEl: HTMLDivElement | null = null;
  private titleEl: HTMLSpanElement | null = null;
  private observer: MutationObserver | null = null;

  connectedCallback() {
    if (this.contentEl) {
      this.updateTitle(); // re-connected: re-sync in case title changed while detached
      return;
    }

    const existingChildren = Array.from(this.childNodes);

    this.className = 'block border border-terminal-dim rounded-md overflow-hidden';
    this.textContent = '';

    const header = document.createElement('div');
    header.className =
      'flex items-center gap-2 px-3 py-2 border-b border-terminal-dim bg-terminal-dim/20';
    header.innerHTML = `
      <span class="w-2.5 h-2.5 rounded-full bg-terminal-red"></span>
      <span class="w-2.5 h-2.5 rounded-full bg-terminal-amber"></span>
      <span class="w-2.5 h-2.5 rounded-full bg-terminal-fg"></span>
    `;
    this.titleEl = document.createElement('span');
    this.titleEl.className = 'ml-2 text-sm text-terminal-dim';
    header.appendChild(this.titleEl);
    this.updateTitle();

    const content = document.createElement('div');
    content.className = 'p-4';
    existingChildren.forEach((node) => content.appendChild(node));
    this.contentEl = content;

    this.append(header, content);

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.parentNode === this && node !== header && node !== content) {
            content.appendChild(node);
          }
        });
      }
    });
    this.observer.observe(this, { childList: true });
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    this.observer = null;
  }

  attributeChangedCallback(name: string) {
    if (name === 'title') this.updateTitle();
  }

  private updateTitle() {
    if (!this.titleEl) return; // not connected/built yet; connectedCallback will sync it
    const title = this.getAttribute('title') ?? '';
    this.titleEl.textContent = title;
    this.titleEl.style.display = title ? '' : 'none';
  }
}

export function registerIotaWindow() {
  if (!customElements.get('iota-window')) {
    customElements.define('iota-window', IotaWindow);
  }
}
