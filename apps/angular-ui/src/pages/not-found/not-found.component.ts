import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <iota-window title="404">
      <p>command not found: {{ path }}</p>
      <p class="mt-2"><a routerLink="/" class="underline">cd ~</a></p>
    </iota-window>
  `
})
export class NotFoundComponent {
  path = window.location.pathname;
}
