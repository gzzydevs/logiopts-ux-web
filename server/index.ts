import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import buttonsRouter from './routes/buttons.js';
import configRouter from './routes/config.js';
import profilesRouter from './routes/profiles.js';
import actionsRouter from './routes/actions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.use(express.json());

// API routes
app.use('/api', buttonsRouter);
app.use('/api', configRouter);
app.use('/api', profilesRouter);
app.use('/api', actionsRouter);

// Serve static React build in production
const distPath = resolve(__dirname, '../dist');
app.use(express.static(distPath));
app.get('/{*path}', (_req, res) => {
  res.sendFile(resolve(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`LogiTux server running on http://localhost:${PORT}`);
});
