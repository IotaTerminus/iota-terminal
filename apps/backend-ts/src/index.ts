/**
 * backend-ts: the TypeScript implementation of the iota-terminal API contract.
 */
import express from 'express';

const app = express();
const port = 8082;

app.get('/api/ts/system/status', (_req, res) => {
  res.json({
    backend: 'ts',
    status: 'online',
    version: '1.0.0'
  });
});

app.listen(port, () => {
  console.log(`backend-ts listening on :${port}`);
});
