export const DEMO_RUNTIME_META_NAME = 'protocap-runtime-profile';
export const DEMO_PUBLIC_ORIGIN_META_NAME = 'protocap-public-origin';

export interface DemoRuntimeConfig {
  isDemo: boolean;
  publicOrigin: string | null;
}

function readMeta(name: string): string | null {
  return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content?.trim() || null;
}

export function readDemoRuntimeConfig(): DemoRuntimeConfig {
  if (readMeta(DEMO_RUNTIME_META_NAME) !== 'demo') {
    return { isDemo: false, publicOrigin: null };
  }

  const rawOrigin = readMeta(DEMO_PUBLIC_ORIGIN_META_NAME);
  if (!rawOrigin) return { isDemo: true, publicOrigin: null };

  try {
    const parsed = new URL(rawOrigin);
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return { isDemo: true, publicOrigin: null };
    }
    if (parsed.origin === window.location.origin) {
      return { isDemo: true, publicOrigin: null };
    }
    return { isDemo: true, publicOrigin: `${parsed.origin}/` };
  } catch {
    return { isDemo: true, publicOrigin: null };
  }
}

export function buildProtoCapPublicUrl(pathname = '/'): string | null {
  const { isDemo, publicOrigin } = readDemoRuntimeConfig();
  if (!isDemo || !publicOrigin) return null;

  const target = new URL(publicOrigin);
  target.pathname = pathname.startsWith('/') ? pathname.split(/[?#]/, 1)[0] : '/';
  target.search = '';
  target.hash = '';
  return target.toString();
}
