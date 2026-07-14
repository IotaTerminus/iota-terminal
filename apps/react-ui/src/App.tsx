import { useEffect, useState } from 'react';
import { getActiveBackend, getApiBaseUrl, type BackendId } from './backend';

interface SystemStatus {
  backend: string;
  status: string;
  version: string;
}

export default function App() {
  const [activeBackend] = useState<BackendId>(getActiveBackend());
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    fetch(`${getApiBaseUrl()}/system/status`)
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl">
        iota-terminal <span className="terminal-cursor">&nbsp;</span>
      </h1>
      <p>react-ui &mdash; active backend: {activeBackend}</p>
      <pre>{status ? JSON.stringify(status, null, 2) : 'connecting...'}</pre>
    </main>
  );
}
