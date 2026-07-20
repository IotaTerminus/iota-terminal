import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RESUME } from '@iota/content';

@Component({
  selector: 'app-resume',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <iota-window title="~/resume.md">
      <div class="flex flex-col gap-6">
        <p>{{ resume.summary }}</p>

        <section>
          <h2 class="text-terminal-fg mb-2"># skills</h2>
          <p class="text-sm text-terminal-dim">{{ resume.skills.join(', ') }}</p>
        </section>

        <section>
          <h2 class="text-terminal-fg mb-2"># experience</h2>
          <div class="flex flex-col gap-4">
            @for (role of resume.experience; track role.id) {
              <div>
                <p>{{ role.role }} &mdash; {{ role.company }}</p>
                <p class="text-sm text-terminal-dim">{{ role.startDate }} &ndash; {{ role.endDate ?? 'present' }}</p>
                <ul class="list-disc list-inside text-sm">
                  @for (highlight of role.highlights; track $index) {
                    <li>{{ highlight }}</li>
                  }
                </ul>
              </div>
            }
          </div>
        </section>

        <section>
          <h2 class="text-terminal-fg mb-2"># education</h2>
          <div class="flex flex-col gap-2">
            @for (edu of resume.education; track edu.id) {
              <p class="text-sm">{{ edu.degree }}, {{ edu.institution }} ({{ edu.graduationYear }})</p>
            }
          </div>
        </section>
      </div>
    </iota-window>
  `
})
export class ResumeComponent {
  resume = RESUME;
}
