import { ABOUT_ME } from '@iota/content';

export default function AboutMe() {
  return (
    <iota-window title={`~/${ABOUT_ME.heading}`}>
      <div className="flex flex-col gap-4">
        {ABOUT_ME.paragraphs.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </iota-window>
  );
}
