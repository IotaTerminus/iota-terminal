import { Component, CUSTOM_ELEMENTS_SCHEMA, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NAV_ITEMS } from '@iota/content';

/**
 * Shared page chrome: nav bar (driven by @iota/content's NAV_ITEMS, the
 * single source of truth also used by the React nav/router) plus the
 * routed page content. Also mounts the embedded <iota-terminal> panel and
 * bridges its `iota-terminal:navigate` CustomEvent to the Angular Router,
 * since the terminal is a framework-agnostic Custom Element that can't
 * call Router.navigateByUrl() directly.
 */
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './layout.component.html'
})
export class LayoutComponent implements OnInit, OnDestroy {
  navItems = NAV_ITEMS;

  constructor(private router: Router) {}

  private readonly handleNavigate = (event: Event) => {
    const path = (event as CustomEvent<{ path: string }>).detail?.path;
    if (path) this.router.navigateByUrl(path);
  };

  ngOnInit(): void {
    document.addEventListener('iota-terminal:navigate', this.handleNavigate);
  }

  ngOnDestroy(): void {
    document.removeEventListener('iota-terminal:navigate', this.handleNavigate);
  }
}
