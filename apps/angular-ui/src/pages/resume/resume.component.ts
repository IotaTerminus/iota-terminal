import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RESUME } from '@iota/content';

@Component({
  selector: 'app-resume',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './resume.component.html'
})
export class ResumeComponent {
  resume = RESUME;
}
