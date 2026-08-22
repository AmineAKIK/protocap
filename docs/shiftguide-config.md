# ShiftGuide runtime configuration

ShiftGuide reads protected runtime content from server-side environment variables. These values are parsed and validated before ShiftGuide can be enabled. The browser receives only the validated client payload after a successful unlock.

## Variables

| Variable | Required when ShiftGuide is enabled | Purpose |
| --- | --- | --- |
| `SHIFTGUIDE_CODE` | yes | server-side unlock secret |
| `SG_MODULES` | yes | JSON module/procedure configuration |
| `SG_LEXIQUE` | yes | JSON lexicon configuration |
| `SG_SYSTEM_PROMPT` | no | additional server-only context appended to Céline's prompt |
| `SG_URGENCES` | no | JSON emergency/safety content; the server uses its validated default when omitted |
| `DEEPSEEK_API_KEY` | required for Céline | server-side AI-provider credential |

`VITE_*` secret names are legacy migration fallbacks only and must not be used for new deployments.

## Contract invariants

The runtime validator in `shared/shiftGuideContract.js` is shared by server and client. It rejects configuration that would violate application assumptions:

- at least one module is required;
- standard modules contain at least one action;
- choice modules contain at least one submodule and every submodule contains at least one action;
- action IDs are globally unique because progress is keyed globally by action ID;
- module and submodule IDs are globally unique because they identify routes/progress scopes;
- lexicon sigles are unique case-insensitively;
- emergency collections and required emergency strings are non-empty.

An invalid configured ShiftGuide payload fails closed when ShiftGuide is enabled. This prevents partially valid procedures or safety content from being served.

## `SG_URGENCES` schema

`SG_URGENCES` is a single JSON object. If the variable is not configured, the server uses `DEFAULT_SHIFTGUIDE_URGENCES` from `server/shiftGuideDefaults.mjs`, which preserves the current application content.

When overriding it, provide the complete object rather than a partial patch:

```json
{
  "emergencyNumbers": ["15", "18"],
  "generalAlarm": {
    "signal": "Sirène longue",
    "instruction": "Évacuation générale immédiate",
    "steps": [
      "Sorties de secours les plus proches",
      "Point de rassemblement par l'extérieur",
      "Toujours avancer, pas de retour arrière",
      "Répondre à l'appel",
      "Reprise uniquement après autorisation"
    ]
  },
  "drill": {
    "schedule": "Premier mardi de chaque mois à 15h",
    "instruction": "Ne pas évacuer"
  },
  "accidentSteps": [
    {
      "id": "proteger",
      "label": "Protéger",
      "description": "Arrêt d'urgence, balisage, zone sécurisée."
    },
    {
      "id": "alerter",
      "label": "Alerter",
      "description": "15 ou 18 depuis un poste interne."
    },
    {
      "id": "secourir",
      "label": "Secourir",
      "description": "Rester disponible, suivre les consignes."
    }
  ],
  "goldenRules": [
    {
      "id": "loto",
      "label": "LOTO",
      "description": "Consignation, déconsignation et carter ouvert."
    }
  ],
  "priorityMessage": "En doute, on stoppe et on alerte.",
  "priorityDescription": "La priorité reste la mise en sécurité des personnes, puis de la zone."
}
```

The example intentionally shortens `goldenRules`; a configured production value still needs at least one valid rule, while the repository default contains the complete current set.

## Rollout note

Before deploying a change that explicitly sets `SG_URGENCES`, validate the JSON against the repository contract. If Railway currently has no `SG_URGENCES` value, no migration is required: the server fallback is used automatically.

If Railway already has a legacy `SG_URGENCES` value in another shape, update it to this contract or remove the variable to use the repository default before deploying this change.
