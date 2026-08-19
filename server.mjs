import { randomBytes } from 'crypto';
import express from 'express';
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = existsSync(join(__dirname, 'dist'))
  ? join(__dirname, 'dist')
  : resolve(process.cwd(), 'dist');

const PORT = process.env.PORT || 3000;
const SHIFTGUIDE_CODE = process.env.SHIFTGUIDE_CODE ?? process.env.VITE_SHIFTGUIDE_CODE ?? '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? process.env.VITE_DEEPSEEK_API_KEY ?? '';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();

const app = express();
app.use(express.json({ limit: '128kb' }));

function issueSession() {
  const token = randomBytes(32).toString('base64url');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function getSessionToken(req) {
  const authorization = req.get('authorization') ?? '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

function hasValidSession(req) {
  const token = getSessionToken(req);
  if (!token) return false;

  const expiresAt = sessions.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }

  return true;
}

function isValidChatMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) return false;

  return messages.every((message, index) => {
    if (!message || typeof message !== 'object') return false;
    if (!['system', 'user', 'assistant'].includes(message.role)) return false;
    if (index === 0 && message.role !== 'system') return false;
    if (index > 0 && message.role === 'system') return false;
    return typeof message.content === 'string' && message.content.length <= 20_000;
  });
}

// ── API ──────────────────────────────────────────────────────────────────────

app.post('/api/shiftguide/unlock', (req, res) => {
  if (!SHIFTGUIDE_CODE) {
    return res.status(503).json({ error: 'Accès ShiftGuide non configuré.' });
  }

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

  const token = issueSession();
  return res.json({ token, modules, lexique, systemPromptExtra, urgences });
});

app.post('/api/celine/chat', async (req, res) => {
  if (!hasValidSession(req)) {
    return res.status(401).json({ error: 'Session ShiftGuide invalide ou expirée.' });
  }

  if (!DEEPSEEK_API_KEY) {
    return res.status(503).json({ error: 'Service IA non configuré.' });
  }

  const { messages } = req.body ?? {};
  if (!isValidChatMessages(messages)) {
    return res.status(400).json({ error: 'Requête IA invalide.' });
  }

  try {
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return res.status(429).json({ error: 'Service IA temporairement saturé.' });
      }
      return res.status(502).json({ error: 'Service IA indisponible.' });
    }

    const payload = await upstream.json();
    return res.json(payload);
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Service IA trop lent.' });
    }
    return res.status(502).json({ error: 'Service IA indisponible.' });
  }
});

// ── Static SPA ────────────────────────────────────────────────────────────────

app.use(express.static(DIST));

app.get('/{*path}', (_req, res) => {
  res.sendFile(join(DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
