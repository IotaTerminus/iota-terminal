import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { PROJECTS } from '@iota/content';

@Component({
  selector: 'app-projects',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <iota-window title="~/projects">
      <ul class="flex flex-col gap-6">
        @for (project of projects; track project.id) {
          <li class="flex flex-col gap-1">
            <h2 class="text-lg text-terminal-fg">{{ project.title }}</h2>
            <p>{{ project.description }}</p>
            <p class="text-sm text-terminal-dim">{{ project.technologies.join(' · ') }}</p>
            <div class="flex gap-4 text-sm">
              <a [href]="project.githubUrl" class="underline" target="_blank" rel="noreferrer">source</a>
              @if (project.liveUrl) {
                <a [href]="project.liveUrl" class="underline" target="_blank" rel="noreferrer">live</a>
              }
            </div>
          </li>
        }
      </ul>
    </iota-window>
  `
})
export class ProjectsComponent {
  projects = PROJECTS;
}
