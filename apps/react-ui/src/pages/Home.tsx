import { useEffect, useState } from 'react';
import { getActiveBackend, getApiBaseUrl, type BackendId } from '../backend';
import type { SystemStatus } from '@iota/types';

export default function Home() {
  const [activeBackend] = useState<BackendId>(getActiveBackend());
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    fetch(`${getApiBaseUrl()}/system/status`)
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  return (
    <iota-window title="~/home">
      <p>react-ui &mdash; active backend: {activeBackend}</p>
      <pre>{status ? JSON.stringify(status, null, 2) : 'connecting...'}</pre>
    </iota-window>
  );
}
