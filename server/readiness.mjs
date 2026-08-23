export function createReadinessSnapshot({
  shiftGuideCode,
  shiftGuideClientData,
  configRevision,
  celineAuthorityRevision,
  celineSystemPrompt,
  celineAuthority,
  celineProvider,
} = {}) {
  const shiftGuideReady = Boolean(
    shiftGuideCode &&
    shiftGuideClientData &&
    configRevision &&
    celineAuthorityRevision &&
    celineSystemPrompt &&
    celineAuthority
  );
  const celineReady = Boolean(
    shiftGuideReady &&
    celineProvider &&
    typeof celineProvider.complete === 'function'
  );

  return {
    ok: shiftGuideReady && celineReady,
    checks: {
      shiftGuide: shiftGuideReady,
      celine: celineReady,
    },
  };
}
