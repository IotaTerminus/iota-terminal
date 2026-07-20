import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ABOUT_ME } from '@iota/content';

@Component({
  selector: 'app-about-me',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <iota-window [attr.title]="'~/' + heading">
      <div class="flex flex-col gap-4">
        @for (paragraph of paragraphs; track $index) {
          <p>{{ paragraph }}</p>
        }
      </div>
    </iota-window>
  `
})
export class AboutMeComponent {
  heading = ABOUT_ME.heading;
  paragraphs = ABOUT_ME.paragraphs;
}
