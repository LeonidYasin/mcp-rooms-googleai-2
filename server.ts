import express from 'express';
import { app, createApp } from './server/app';

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    // Vite is a dev dependency: import it lazily so the production image can be
    // built without devDependencies (see Dockerfile, `prod-deps` stage).
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    // Express 5 / path-to-regexp v8: bare '*' is invalid, use a named splat.
    app.get('/{*splat}', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MCP Rooms server with SQLite & JSON-RPC running on http://0.0.0.0:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  start();
}

export { app, start, createApp };
