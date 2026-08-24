const MAX_PROVIDER_TURNS = 8;
const MAX_USER_MESSAGE_LENGTH = 4_000;
const PROVIDER_DECISION_KINDS = new Set(['route', 'clarify', 'lexicon', 'emergency', 'unknown']);

export function extractLatestCelineUserMessage(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) return null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== 'object' || message.role !== 'user') continue;
    if (
      typeof message.content !== 'string' ||
      message.content.length === 0 ||
      message.content.length > MAX_USER_MESSAGE_LENGTH
    ) {
      return null;
    }
    return message.content;
  }

  return null;
}

export function buildCelineProviderHistory(context, userMessage) {
  const prior = Array.isArray(context) ? context.slice(-MAX_PROVIDER_TURNS * 2) : [];
  return [...prior, { role: 'user', content: userMessage }];
}

export function appendCelineProviderDecision(context, userMessage, decision) {
  const prior = Array.isArray(context) ? context : [];
  if (
    !decision ||
    typeof decision !== 'object' ||
    !PROVIDER_DECISION_KINDS.has(decision.kind)
  ) {
    // Deterministic domain events are represented by operational state, not by
    // provider conversation examples. Keeping them out preserves a clean prompt contract.
    return prior.slice(-MAX_PROVIDER_TURNS * 2);
  }

  const decisionContent = JSON.stringify(decision);
  const next = [
    ...prior,
    { role: 'user', content: userMessage },
    { role: 'assistant', content: decisionContent },
  ];
  return next.slice(-MAX_PROVIDER_TURNS * 2);
}
