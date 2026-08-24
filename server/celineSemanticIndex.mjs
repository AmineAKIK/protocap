const STOP_WORDS = new Set([
  'a','ai','au','aux','avec','ce','ces','cette','de','des','du','en','et','faire','faut','il','je','la','le','les','me','mes','mon','pour','que','quoi','sur','tu','un','une','quoi','dois','doit','comme','dans','est','suis','quoi','ça','ca',
]);

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\bfinis\b/g, 'fin')
    .replace(/\bterminees?\b/g, 'termine')
    .replace(/\bcloturees?\b/g, 'cloture');
}

function tokensFor(value) {
  return [...new Set(normalizeText(value).split(/\s+/).filter((token) => token.length >= 3 && !STOP_WORDS.has(token)))];
}

function collectEntries(modules) {
  const entries = [];
  for (const module of modules) {
    if (module.type === 'choice') {
      for (const subModule of module.subModules) {
        for (const action of subModule.actions) {
          entries.push({
            actionId: action.id,
            moduleId: module.id,
            scopeId: subModule.id,
            moduleTitle: subModule.title,
            text: action.text,
            note: action.note ?? null,
          });
        }
      }
      continue;
    }
    for (const action of module.actions) {
      entries.push({
        actionId: action.id,
        moduleId: module.id,
        scopeId: module.id,
        moduleTitle: module.title,
        text: action.text,
        note: action.note ?? null,
      });
    }
  }
  return entries;
}

function scoreEntry(entry, queryTokens, preferredScopes) {
  const actionTokens = new Set(entry.tokens ?? tokensFor(`${entry.text} ${entry.note ?? ''} ${entry.moduleTitle}`));
  let semanticScore = 0;
  for (const token of queryTokens) {
    if (actionTokens.has(token)) semanticScore += token.length >= 8 ? 4 : 3;
    else if ([...actionTokens].some((candidate) => candidate.startsWith(token) || token.startsWith(candidate))) semanticScore += 1;
  }

  // Context is only a ranking signal. It must never make an unrelated action
  // eligible on its own, otherwise every action in the current module can leak
  // into a precise answer such as “quel prélèvement ?”.
  if (semanticScore === 0) return 0;

  const scopeBoost = preferredScopes.has(entry.scopeId) || preferredScopes.has(entry.moduleId) ? 4 : 0;
  return semanticScore + scopeBoost;
}

export function createCelineSemanticIndex(config) {
  const entries = collectEntries(config.modules).map((entry) => ({
    ...entry,
    tokens: tokensFor(`${entry.text} ${entry.note ?? ''} ${entry.moduleTitle}`),
  }));
  return { entries };
}

export function searchCelineActions(index, query, { preferredScopes = [], limit = 3 } = {}) {
  const queryTokens = tokensFor(query);
  if (queryTokens.length === 0) return [];
  const scopes = new Set(preferredScopes.filter(Boolean));
  return index.entries
    .map((entry) => ({ entry, score: scoreEntry(entry, queryTokens, scopes) }))
    .filter(({ score }) => score >= 3)
    .sort((a, b) => b.score - a.score || a.entry.actionId.localeCompare(b.entry.actionId))
    .slice(0, Math.max(1, Math.min(limit, 5)))
    .map(({ entry, score }) => ({ ...entry, score }));
}

export function normalizeCelineSearchText(value) {
  return normalizeText(value);
}
