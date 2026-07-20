import { ABOUT_SITE } from '@iota/content';

export default function AboutSite() {
  return (
    <iota-window title="~/site.md">
      <div className="flex flex-col gap-4">
        {ABOUT_SITE.paragraphs.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </iota-window>
  );
}
