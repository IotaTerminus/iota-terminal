import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ABOUT_ME } from '@iota/content';

@Component({
  selector: 'app-about-me',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './about-me.component.html'
})
export class AboutMeComponent {
  heading = ABOUT_ME.heading;
  paragraphs = ABOUT_ME.paragraphs;
}
