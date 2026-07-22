import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { PROJECTS } from '@iota/content';

@Component({
  selector: 'app-projects',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './projects.component.html'
})
export class ProjectsComponent {
  projects = PROJECTS;
}
