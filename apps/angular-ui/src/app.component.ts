import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getActiveBackend, getApiBaseUrl, type BackendId } from './backend';

interface SystemStatus {
  backend: string;
  status: string;
  version: string;
}

/**
 * The root domain (iotaterminus.dev) is onboarding-only: it never runs the
 * terminal demo itself, it just points visitors at the two live frontends.
 * Both angular.iotaterminus.dev and react.iotaterminus.dev host the full
 * app, so the same Angular build has to behave differently depending on
 * which hostname it was served under (see deploy/cloudflared/config.yml).
 */
const ROOT_DOMAIN = 'iotaterminus.dev';

@Component({
    selector: 'app-root',
    imports: [CommonModule],
    template: `
    @if (isOnboarding) {
      <main
        class="min-h-screen flex flex-col items-center justify-center gap-4"
        >
        <h1 class="text-2xl">iota-terminal <span class="terminal-cursor">&nbsp;</span></h1>
        <p>Pick a front-end to explore the boilerplate:</p>
        <div class="flex gap-4">
          <a href="https://react.iotaterminus.dev" class="underline">react-ui</a>
          <a href="https://angular.iotaterminus.dev" class="underline">angular-ui</a>
        </div>
      </main>
    } @else {
      <main class="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 class="text-2xl">iota-terminal <span class="terminal-cursor">&nbsp;</span></h1>
        <p>angular-ui &mdash; active backend: {{ activeBackend }}</p>
        <pre>{{ status ? (status | json) : 'connecting...' }}</pre>
      </main>
    }
    `
})
export class AppComponent implements OnInit {
  isOnboarding = window.location.hostname === ROOT_DOMAIN;
  activeBackend: BackendId = getActiveBackend();
  status: SystemStatus | null = null;

  ngOnInit(): void {
    if (this.isOnboarding) {
      return;
    }
    fetch(`${getApiBaseUrl()}/system/status`)
      .then((res) => res.json())
      .then((data: SystemStatus) => (this.status = data))
      .catch(() => (this.status = null));
  }
}
