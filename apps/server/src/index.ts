import express from 'express';
import cors from 'cors';
import { Store } from './db.js';
import { setupRoutes } from './routes.js';

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const store = new Store();
setupRoutes(app, store);

// Serve the built web UI if present (single-container deploy).
const webDist = process.env.WEB_DIST;
if (webDist) {
  app.use(express.static(webDist));
  app.get('*', (_req, res) => res.sendFile('index.html', { root: webDist }));
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: err.message || 'internal error' });
});

app.listen(port, () => {
  console.log(`storytime server → http://localhost:${port}`);
  console.log(`  health: http://localhost:${port}/api/health`);
});
