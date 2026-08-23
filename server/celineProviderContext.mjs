const MAX_PROVIDER_TURNS = 8;
const MAX_USER_MESSAGE_LENGTH = 4_000;

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
  const decisionContent = JSON.stringify(
    decision && typeof decision === 'object' ? decision : { kind: 'unknown' }
  );
  const next = [
    ...(Array.isArray(context) ? context : []),
    { role: 'user', content: userMessage },
    { role: 'assistant', content: decisionContent },
  ];
  return next.slice(-MAX_PROVIDER_TURNS * 2);
}
