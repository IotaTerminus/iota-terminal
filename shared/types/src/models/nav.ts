export interface NavItem {
  /** Stable identifier, also used as the React/Angular route key. */
  id: string;
  /** Path segment relative to the app root, '' for the index/home route. */
  path: string;
  /** Short label rendered in the nav bar, styled like a shell command. */
  label: string;
}
