import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { registerIotaCursor, registerIotaWindow, registerIotaTerminal } from '@iota/ui';

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
registerIotaTerminal();

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.component.html'
})
export class AppComponent {
  isOnboarding = window.location.hostname === ROOT_DOMAIN;
}
