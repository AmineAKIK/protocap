export function createScenarioProvider() {
  return {
    model: 'protocap-demo-scenario-v1',
    async complete({ history }) {
      const last = Array.isArray(history) ? history.at(-1)?.content ?? '' : '';
      const text = String(last).toLocaleLowerCase('fr-FR');

      if (text.includes('indisponible')) {
        throw new Error('Synthetic provider unavailable');
      }

      if (text.includes('clarif') || text.includes('précis') || text.includes('precis')) {
        return JSON.stringify({ kind: 'clarify', id: 'demo_clarify' });
      }

      if (text.includes('inconnu') || text.includes('unknown')) {
        return JSON.stringify({ kind: 'unknown' });
      }

      return JSON.stringify({ kind: 'route', id: 'demo_start' });
    },
  };
}
