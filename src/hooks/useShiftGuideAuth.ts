const SESSION_KEY = 'shiftguide_auth';
const EXPECTED = import.meta.env.VITE_SHIFTGUIDE_CODE ?? '';

export function isShiftGuideUnlocked(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === EXPECTED;
}

export function unlockShiftGuide(code: string): boolean {
  if (code === EXPECTED) {
    sessionStorage.setItem(SESSION_KEY, EXPECTED);
    return true;
  }
  return false;
}
