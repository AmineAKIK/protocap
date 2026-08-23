# ShiftGuide runtime configuration

ShiftGuide reads protected runtime content from server-side environment variables. These values are parsed and validated before ShiftGuide can be enabled. The browser receives only the validated client payload after a successful unlock.

## Variables

| Variable | Required when ShiftGuide is enabled | Purpose |
| --- | --- | --- |
| `SHIFTGUIDE_CODE` | yes | server-side unlock secret |
| `SG_MODULES` | yes | JSON module/procedure configuration |
| `SG_LEXIQUE` | yes | JSON lexicon configuration |
| `SG_SYSTEM_PROMPT` | no | additional server-only, non-authoritative classification context for Céline |
| `SG_URGENCES` | no | JSON emergency/safety content; the server uses its validated default when omitted |
| `SG_CELINE_ROUTING` | no | server-only declarative Céline routing; the repository default is used when omitted |
| `DEEPSEEK_API_KEY` | required for Céline | server-side AI-provider credential |

Secrets must remain server-side. Do not introduce `VITE_*` names for secrets or protected runtime configuration.

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

## Céline routing compatibility contract

Céline routing is deliberately server-only. It is not part of the browser `ShiftGuideData` payload because it defines how the server/classifier maps terrain context to authoritative procedure sequences.

`SG_CELINE_ROUTING`, when set, is a complete JSON object with this shape:

```json
{
  "version": 1,
  "routes": [
    {
      "id": "debut_oc",
      "label": "Début OC",
      "decisionGuide": "Début d’un OC quand le précédent est déjà clôturé.",
      "actionIds": ["doc_01", "doc_02"]
    }
  ],
  "clarifications": [
    {
      "id": "debut_oc_precedent",
      "question": "L’OC précédent est-il déjà clôturé ?",
      "decisionGuide": "Utiliser au début d’un OC si l’état du précédent est inconnu."
    }
  ],
  "classifierRules": [
    "Le message courant prime sur l’historique en cas de conflit."
  ]
}
```

The object is validated against the already validated `SG_MODULES` configuration before ShiftGuide starts. Every declared route must reference existing action IDs, route IDs must be unique, action IDs cannot repeat within one route, clarifications must be complete and classifier rules must be non-empty. If the routing is incompatible, the server refuses to start ShiftGuide instead of silently dropping unsupported routes.

When `SG_CELINE_ROUTING` is omitted, `server/celineRoutingDefault.mjs` supplies the repository's current production routing contract. An environment override is useful only when a deployment intentionally owns a different routing topology; it is not a mechanism for bypassing validation.

The Céline authority revision is derived from the validated routing content plus the authority protocol revision. Therefore changing a route, its selection guidance, a clarification or a classifier rule automatically invalidates stale Céline conversation history while leaving ShiftGuide progress intact.

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

## Rollout notes

Before deploying a change that explicitly sets `SG_URGENCES` or `SG_CELINE_ROUTING`, validate the JSON against the repository contracts. For routing changes, validate them together with the exact `SG_MODULES` value from the target environment: compatibility is intentionally cross-configuration, not shape-only.

If Railway currently has no `SG_URGENCES` or `SG_CELINE_ROUTING` value, no migration is required: repository defaults are used automatically. A deployment with custom routing should add `SG_CELINE_ROUTING` atomically with any `SG_MODULES` change it depends on.
