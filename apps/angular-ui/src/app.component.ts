import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { registerIotaCursor, registerIotaWindow } from '@iota/ui';

/**
 * The root domain (iotaterminus.dev) is onboarding-only: it never runs the
 * terminal demo itself, it just points visitors at the two live frontends.
 * Both angular.iotaterminus.dev and react.iotaterminus.dev host the full
 * app, so the same Angular build has to behave differently depending on
 * which hostname it was served under (see deploy/cloudflared/config.yml).
 * The full app (nav + routed pages) lives behind RouterOutlet/LayoutComponent,
 * wired via app.routes.ts, and only renders when isOnboarding is false.
 */
const ROOT_DOMAIN = 'iotaterminus.dev';

registerIotaCursor();
registerIotaWindow();

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    standalone: true,
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    template: `
    @if (isOnboarding) {
      <main
        class="min-h-screen flex flex-col items-center justify-center gap-4"
        >
        <h1 class="text-2xl">iota-terminal <iota-cursor></iota-cursor></h1>
        <p>Pick a front-end to explore the boilerplate:</p>
        <div class="flex gap-4">
          <a href="https://react.iotaterminus.dev" class="underline">react-ui</a>
          <a href="https://angular.iotaterminus.dev" class="underline">angular-ui</a>
        </div>
      </main>
    } @else {
      <router-outlet></router-outlet>
    }
    `
})
export class AppComponent {
  isOnboarding = window.location.hostname === ROOT_DOMAIN;
}
