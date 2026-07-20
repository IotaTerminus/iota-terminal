import { RESUME } from '@iota/content';

export default function Resume() {
  return (
    <iota-window title="~/resume.md">
      <div className="flex flex-col gap-6">
        <p>{RESUME.summary}</p>

        <section>
          <h2 className="text-terminal-fg mb-2"># skills</h2>
          <p className="text-sm text-terminal-dim">{RESUME.skills.join(', ')}</p>
        </section>

        <section>
          <h2 className="text-terminal-fg mb-2"># experience</h2>
          <div className="flex flex-col gap-4">
            {RESUME.experience.map((role) => (
              <div key={role.id}>
                <p>
                  {role.role} &mdash; {role.company}
                </p>
                <p className="text-sm text-terminal-dim">
                  {role.startDate} &ndash; {role.endDate ?? 'present'}
                </p>
                <ul className="list-disc list-inside text-sm">
                  {role.highlights.map((highlight, i) => (
                    <li key={i}>{highlight}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-terminal-fg mb-2"># education</h2>
          <div className="flex flex-col gap-2">
            {RESUME.education.map((edu) => (
              <p key={edu.id} className="text-sm">
                {edu.degree}, {edu.institution} ({edu.graduationYear})
              </p>
            ))}
          </div>
        </section>
      </div>
    </iota-window>
  );
}
