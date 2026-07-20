import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <iota-window title="404">
      <p>command not found: {window.location.pathname}</p>
      <p className="mt-2">
        <Link to="/" className="underline">
          cd ~
        </Link>
      </p>
    </iota-window>
  );
}
