import { createDemoServerEnvironment } from './runtimeFixtures.mjs';

// Hosted demo entrypoint for the Docker image: `node demo/startHostedDemo.mjs`.
// Same synthetic fixtures and scripted Céline provider as `npm run demo`, without any real data
// or external AI provider. The real application origin is mandatory for exits and redirects.
const publicUrl = (process.env.PROTOCAP_PUBLIC_URL ?? '').trim();
if (!publicUrl) {
  throw new Error('PROTOCAP_PUBLIC_URL (the real ProtoCap origin) is required for the hosted demo.');
}
if ((process.env.DEEPSEEK_API_KEY ?? '').trim()) {
  throw new Error('Hosted demo refuses an inherited DEEPSEEK_API_KEY; remove it from the demo environment.');
}

const demoEnv = createDemoServerEnvironment({
  ...process.env,
  PROTOCAP_DEMO_PROVIDER: '1',
  PROTOCAP_PUBLIC_URL: publicUrl,
});
for (const key of Object.keys(process.env)) delete process.env[key];
Object.assign(process.env, demoEnv);

await import('../server.mjs');
