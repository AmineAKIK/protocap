export function resolveServerSecret(env, primaryName, legacyName) {
  const primary = env?.[primaryName];
  if (typeof primary === 'string' && primary.length > 0) return primary;

  const legacy = env?.[legacyName];
  if (typeof legacy === 'string' && legacy.length > 0) return legacy;

  return '';
}
