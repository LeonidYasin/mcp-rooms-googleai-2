import express from 'express';
import { initDatabase } from './db';
import {
  JSON_BODY_LIMIT,
  corsPolicy,
  httpErrorHandler,
  securityHeaders,
} from './http-guard';

import { uploadsRouter, uploadsDir } from './routes/uploads';
import { mcpRouter } from './routes/mcp';
import { authRouter } from './routes/auth';
import { embeddingsRouter } from './routes/embeddings';
import { healthRouter } from './routes/health';
import { profilesRouter } from './routes/profiles';
import { listingsRouter } from './routes/listings';
import { roomsRouter } from './routes/rooms';
import { negotiationsRouter } from './routes/negotiations';
import { webhooksRouter } from './routes/webhooks';
import { feedbackRouter } from './routes/feedback';
import { chatRouter } from './routes/chat';

/**
 * Creates and configures the Express application with all middlewares and route controllers.
 * Safe for component and integration tests without binding network ports.
 */
export function createApp(): express.Express {
  // Initialize persistent SQLite database on disk
  initDatabase();

  const app = express();

  // Security and proxy setup
  app.disable('x-powered-by');
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
  app.use(securityHeaders);
  app.use(corsPolicy);
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  // Static uploads serving
  app.use('/uploads', express.static(uploadsDir));

  // Mount modular route controllers
  app.use(uploadsRouter);
  app.use(mcpRouter);
  app.use(authRouter);
  app.use(embeddingsRouter);
  app.use(healthRouter);
  app.use(profilesRouter);
  app.use(listingsRouter);
  app.use(roomsRouter);
  app.use(negotiationsRouter);
  app.use(webhooksRouter);
  app.use(feedbackRouter);
  app.use(chatRouter);

  // Body-parser failures (413/400) and uncaught route errors end here instead of
  // Express' default HTML page. Registered at module load so tests see it too.
  app.use(httpErrorHandler);

  return app;
}

export const app = createApp();
