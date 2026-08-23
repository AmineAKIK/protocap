export const CELINE_SAFE_FALLBACK_RESPONSE = Object.freeze({
  message: 'Je n’ai pas pu déterminer une réponse fiable à partir de ta demande. Précise la situation terrain ou vois avec ton responsable.',
  checklist: [],
  followUp: null,
});

export function createCelineSafeFallbackResponse() {
  return {
    message: CELINE_SAFE_FALLBACK_RESPONSE.message,
    checklist: [],
    followUp: null,
  };
}
