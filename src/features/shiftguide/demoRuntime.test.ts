import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildProtoCapPublicUrl,
  DEMO_PUBLIC_ORIGIN_META_NAME,
  DEMO_RUNTIME_META_NAME,
  readDemoRuntimeConfig,
} from './demoRuntime';

function meta(name: string, content: string) {
  const element = document.createElement('meta');
  element.name = name;
  element.content = content;
  document.head.append(element);
}

describe('ShiftGuide demo runtime boundary', () => {
  beforeEach(() => {
    document.head.querySelectorAll(`meta[name="${DEMO_RUNTIME_META_NAME}"], meta[name="${DEMO_PUBLIC_ORIGIN_META_NAME}"]`)
      .forEach((element) => element.remove());
  });

  afterEach(() => {
    document.head.querySelectorAll(`meta[name="${DEMO_RUNTIME_META_NAME}"], meta[name="${DEMO_PUBLIC_ORIGIN_META_NAME}"]`)
      .forEach((element) => element.remove());
  });

  it('treats an absent or non-demo marker as the protected application', () => {
    expect(readDemoRuntimeConfig()).toEqual({ isDemo: false, publicOrigin: null });
    meta(DEMO_RUNTIME_META_NAME, 'production');
    expect(readDemoRuntimeConfig()).toEqual({ isDemo: false, publicOrigin: null });
    expect(buildProtoCapPublicUrl('/rapport')).toBeNull();
  });

  it('fails closed when the demo return origin is absent, malformed, unsafe, or points to itself', () => {
    meta(DEMO_RUNTIME_META_NAME, ' demo ');
    expect(readDemoRuntimeConfig()).toEqual({ isDemo: true, publicOrigin: null });

    for (const origin of ['not a url', 'ftp://public.example.test/', window.location.origin]) {
      meta(DEMO_PUBLIC_ORIGIN_META_NAME, origin);
      expect(readDemoRuntimeConfig()).toEqual({ isDemo: true, publicOrigin: null });
      document.head.querySelector(`meta[name="${DEMO_PUBLIC_ORIGIN_META_NAME}"]`)?.remove();
    }
  });

  it('normalizes a valid real ProtoCap origin and strips supplied paths', () => {
    meta(DEMO_RUNTIME_META_NAME, 'demo');
    meta(DEMO_PUBLIC_ORIGIN_META_NAME, 'https://protocap.example.test/ignored?query=1#fragment');

    expect(readDemoRuntimeConfig()).toEqual({
      isDemo: true,
      publicOrigin: 'https://protocap.example.test/',
    });
  });

  it('builds same-path cross-origin exits without propagating query strings or fragments', () => {
    meta(DEMO_RUNTIME_META_NAME, 'demo');
    meta(DEMO_PUBLIC_ORIGIN_META_NAME, 'https://protocap.example.test/');

    expect(buildProtoCapPublicUrl('/rapport?secret=discarded#section')).toBe(
      'https://protocap.example.test/rapport',
    );
    expect(buildProtoCapPublicUrl('relative-route')).toBe('https://protocap.example.test/');
    expect(buildProtoCapPublicUrl()).toBe('https://protocap.example.test/');
  });
});
