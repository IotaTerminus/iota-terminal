import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NAV_ITEMS } from '@iota/content';

/**
 * Shared page chrome: nav bar (driven by @iota/content's NAV_ITEMS, the
 * single source of truth also used by the React nav/router) plus the
 * routed page content.
 */
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="min-h-screen flex flex-col gap-6 p-4 md:p-8 max-w-3xl mx-auto">
      <header class="flex flex-col gap-3">
        <h1 class="text-2xl">iota-terminal <iota-cursor></iota-cursor></h1>
        <nav class="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          @for (item of navItems; track item.id) {
            <a
              [routerLink]="'/' + item.path"
              routerLinkActive
              #rla="routerLinkActive"
              [routerLinkActiveOptions]="{ exact: item.path === '' }"
              [class]="rla.isActive ? 'text-terminal-fg underline' : 'text-terminal-dim hover:text-terminal-fg'"
              >{{ item.label }}</a
            >
          }
        </nav>
      </header>
      <main class="flex-1">
        <router-outlet></router-outlet>
      </main>
    </div>
  `
})
export class LayoutComponent {
  navItems = NAV_ITEMS;
}
