// If you are using React 19 / modern types, extend the React JSX namespace:
declare namespace JSX {
  interface IntrinsicElements {
    // Define your custom element.
    // We assign it standard HTML attributes so you can still pass standard props like 'className' or 'id'
    'iota-cursor': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    'iota-window': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    'iota-terminal': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
  }
}
