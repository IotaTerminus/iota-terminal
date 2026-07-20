import { PROJECTS } from '@iota/content';

export default function Projects() {
  return (
    <iota-window title="~/projects">
      <ul className="flex flex-col gap-6">
        {PROJECTS.map((project) => (
          <li key={project.id} className="flex flex-col gap-1">
            <h2 className="text-lg text-terminal-fg">{project.title}</h2>
            <p>{project.description}</p>
            <p className="text-sm text-terminal-dim">{project.technologies.join(' · ')}</p>
            <div className="flex gap-4 text-sm">
              <a href={project.githubUrl} className="underline" target="_blank" rel="noreferrer">
                source
              </a>
              {project.liveUrl && (
                <a href={project.liveUrl} className="underline" target="_blank" rel="noreferrer">
                  live
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </iota-window>
  );
}
