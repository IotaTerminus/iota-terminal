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
  templateUrl: './layout.component.html'
})
export class LayoutComponent {
  navItems = NAV_ITEMS;
}
