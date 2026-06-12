import express from 'express';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
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

  // Lire les données depuis les variables d'environnement Railway
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

app.use(express.static(join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
