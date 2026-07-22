import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ABOUT_SITE } from '@iota/content';

@Component({
  selector: 'app-about-site',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './about-site.component.html'
})
export class AboutSiteComponent {
  paragraphs = ABOUT_SITE.paragraphs;
}
