import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Cherche dist/ depuis __dirname ou process.cwd()
const DIST = existsSync(join(__dirname, 'dist'))
  ? join(__dirname, 'dist')
  : resolve(process.cwd(), 'dist');

console.log('Serving static from:', DIST);

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SHIFTGUIDE_CODE = process.env.VITE_SHIFTGUIDE_CODE ?? '';

// ── API ──────────────────────────────────────────────────────────────────────

app.post('/api/shiftguide/unlock', (req, res) => {
  const { code } = req.body ?? {};
  if (!code || code !== SHIFTGUIDE_CODE) {
    return res.status(401).json({ error: 'Code incorrect.' });
  }

  let modules, lexique, systemPromptExtra, urgences;
  try {
    modules = JSON.parse(process.env.SG_MODULES ?? 'null');
    lexique = JSON.parse(process.env.SG_LEXIQUE ?? 'null');
    systemPromptExtra = process.env.SG_SYSTEM_PROMPT ?? null;
    urgences = JSON.parse(process.env.SG_URGENCES ?? 'null');
  } catch {
    return res.status(500).json({ error: 'Données non configurées sur le serveur.' });
  }

  if (!modules || !lexique) {
    return res.status(500).json({ error: 'Données non configurées sur le serveur.' });
  }

  res.json({ modules, lexique, systemPromptExtra, urgences });
});

// ── Static SPA ────────────────────────────────────────────────────────────────

app.use(express.static(DIST));

app.get('/{*path}', (_req, res) => {
  // Force le browser à vider cache + SW à chaque chargement de l'HTML
  res.setHeader('Clear-Site-Data', '"cache", "storage"');
  res.sendFile(join(DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
