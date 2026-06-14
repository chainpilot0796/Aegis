/**
 * Aegis — skill discovery + delivery route.
 *
 * Mounted at `/api/skills`. Serves the markdown skill files from
 * `<repo-root>/openclaw-skill/` and a programmatic JSON index that mirrors
 * `/.well-known/aegis-skills.json`.
 *
 * Path-traversal safe: every request is resolved + prefix-checked against
 * the skills root. Cross-origin friendly so any agent can `fetch()` it.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Resolve the skills root once. From `server/routes/skills.js` the repo root
// is two levels up; from there, `openclaw-skill/` holds the markdown.
const SKILLS_ROOT = path.resolve(__dirname, '..', '..', 'openclaw-skill');

// Tiny middleware — let any agent fetch these from any origin and cache briefly.
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60');
  next();
});

/**
 * Walk `openclaw-skill/` and produce the same shape as
 * `/.well-known/aegis-skills.json`. The entrypoint (`SKILL.md`) is exposed
 * via the canonical alias `aegis.skill.md`; everything under
 * `strategies/` is listed as a strategy.
 */
function buildIndex() {
  const skills = [];

  if (fs.existsSync(path.join(SKILLS_ROOT, 'SKILL.md'))) {
    skills.push({
      id: 'aegis-0g',
      path: '/api/skills/aegis.skill.md',
      kind: 'entrypoint',
    });
  }

  const stratDir = path.join(SKILLS_ROOT, 'strategies');
  if (fs.existsSync(stratDir)) {
    const files = fs
      .readdirSync(stratDir)
      .filter((f) => f.endsWith('.skill.md'))
      .sort();
    for (const f of files) {
      const slug = f.replace(/\.skill\.md$/, '');
      skills.push({
        id: `aegis-${slug}`,
        path: `/api/skills/strategies/${f}`,
        kind: 'strategy',
      });
    }
  }

  return {
    schema: 'aegis.skills/1',
    entry: '/api/skills/aegis.skill.md',
    skills,
    api: {
      base: '/api',
      endpoints: [
        { method: 'POST', path: '/ai/recommend-shield', auth: 'bearer' },
        { method: 'POST', path: '/yield-shield/simulate', auth: 'bearer' },
        { method: 'POST', path: '/yield-shield/prepare', auth: 'bearer' },
        { method: 'POST', path: '/yield-shield/activate', auth: 'bearer' },
        { method: 'GET', path: '/yield-shield/doc/:rootHash' },
        { method: 'GET', path: '/sponsors/zerog' },
        { method: 'GET', path: '/agents/actions/public' },
      ],
    },
    auth_docs: '/api/skills/aegis.skill.md#how-an-agent-connects',
  };
}

// GET /api/skills/  -> canonical programmatic index
router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(buildIndex());
});

/**
 * GET /api/skills/<path>
 *
 * Serves files under `openclaw-skill/`. The canonical entrypoint URL is
 * `/api/skills/aegis.skill.md`, which maps to `openclaw-skill/SKILL.md`.
 * Anything ending in `.json` is served as JSON; everything else as
 * `text/markdown`.
 */
router.get(/^\/(.+)$/, (req, res) => {
  // express 5 captures into req.params[0]
  const rel = req.params[0] || '';

  // Canonical alias: aegis.skill.md -> SKILL.md
  const target = rel === 'aegis.skill.md' ? 'SKILL.md' : rel;

  // Disallow null bytes outright.
  if (target.includes('\0')) {
    return res.status(400).json({ error: 'invalid path' });
  }

  const abs = path.resolve(SKILLS_ROOT, target);
  // Prefix-check to block ../ escapes. Use path.sep-normalized prefixes so
  // a sibling like `openclaw-skill-evil/` cannot satisfy startsWith.
  const rootWithSep = SKILLS_ROOT + path.sep;
  if (abs !== SKILLS_ROOT && !abs.startsWith(rootWithSep)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  fs.stat(abs, (err, stat) => {
    if (err || !stat || !stat.isFile()) {
      return res.status(404).json({ error: 'not found' });
    }
    const isJson = abs.toLowerCase().endsWith('.json');
    res.setHeader(
      'Content-Type',
      isJson ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8'
    );
    fs.createReadStream(abs).pipe(res);
  });
});

module.exports = router;
