import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ABOUT_SITE } from '@iota/content';

@Component({
  selector: 'app-about-site',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <iota-window title="~/site.md">
      <div class="flex flex-col gap-4">
        @for (paragraph of paragraphs; track $index) {
          <p>{{ paragraph }}</p>
        }
      </div>
    </iota-window>
  `
})
export class AboutSiteComponent {
  paragraphs = ABOUT_SITE.paragraphs;
}
