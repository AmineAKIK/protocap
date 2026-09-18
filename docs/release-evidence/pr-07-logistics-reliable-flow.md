# PR-07 — parcours Logistics fiable

Base : `6dfee8cf86d758ab9a0dd7832c0abd85f8b53d65` (PR-06 fusionnée).

## Défauts corrigés

- un appel pouvait être affiché comme envoyé puis le formulaire remis à zéro alors que `localStorage.setItem` avait échoué ;
- les demandes historiques terminales sans `completedAt` recevaient une heure fabriquée au montage ;
- les transitions terminales n'étaient pas formalisées et l'annulation ne demandait pas de confirmation.

## Contrat

Le workspace Logistics ne met à jour son état React confirmé qu'après une écriture v8 vérifiée. Sur quota, accès, sérialisation, version future ou vérification impossible, aucune confirmation n'est affichée et le formulaire reste intact. Un retry inchangé garde le même identifiant et la même heure de création ; si la première écriture a déjà réussi, le même retry est idempotent.

Les anciennes demandes `pickedUp`/`cancelled` sans `completedAt` restent telles quelles. L'UI affiche « heure inconnue » / « durée inconnue » et n'écrit rien au chargement.

Les transitions autorisées sont explicites. `pickedUp` et `cancelled` sont terminaux. L'annulation exige une confirmation accessible et son `completedAt` est l'instant de cette confirmation.

PR-07 ne traite pas encore la coordination entre deux onglets : révisions/Web Locks restent PR-08.

## Acceptation

T11, T12, T20, T21, T22, T42 et T43. Le nouveau E2E Logistics est sélectionné explicitement par `test:e2e:logistics` et exécuté dans la Quality Gate sur Chromium, Chromium mobile et WebKit.
