export class IotaCursor extends HTMLElement {
  constructor() {
    super();
    // We remove the attachShadow call completely.
  }

  connectedCallback() {
    // We inject directly into the element's Light DOM
    this.innerHTML = `
      <span class="terminal-cursor">&nbsp;</span>
    `;
  }
}

export function registerIotaCursor() {
  if (!customElements.get('iota-cursor')) {
    customElements.define('iota-cursor', IotaCursor);
  }
}