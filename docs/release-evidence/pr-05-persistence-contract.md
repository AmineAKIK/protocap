# PR-05 — contrat de persistance explicite

Base : `5516ce0462cee8ce3aa969a125c5c737a972eb39` (PR-04 fusionnée).

## Défaut parent

Le hook public `useLocalStorage` écrivait pendant l'hydratation. Un JSON invalide, un schéma rejeté, une clé absente ou une normalisation acceptée conduisaient donc à une écriture automatique. Cela pouvait effacer les seuls octets récupérables d'un document corrompu et faisait de la simple lecture un effet de bord durable.

Le setter renvoyait seulement `persisted|degraded`, sans distinguer quota, accès, sérialisation, schéma, vérification ou version future. Il mettait déjà la copie React à jour, ce qui rendait d'autant plus important de distinguer explicitement copie mémoire et écriture durable.

## Contrat PR-05

- aucune écriture lors d'un mount, StrictMode, changement de clé, parse invalide, schéma invalide ou normalisation ;
- les octets invalides restent intacts pour PR-06/08 ; le fallback sûr n'existe qu'en mémoire et porte le statut `recovered` ;
- une clé absente est `memory`, pas artificiellement `persisted` ;
- une version publique plus récente rend le hook `readonly` et bloque toute écriture de l'ancien schéma ;
- chaque écriture valide le schéma runtime, sérialise, appelle `setItem`, puis relit exactement la valeur ; le résultat typé expose `persisted` ou `degraded` avec la cause ;
- en cas d'échec, la nouvelle valeur reste visible dans la copie mémoire et le statut devient dégradé/lecture seule : aucune durabilité n'est revendiquée.

PR-05 ne rend pas les deux clés Expiry atomiques, n'ajoute pas Web Locks/révisions et ne corrige pas encore les confirmations Logistics. Ces comportements appartiennent à PR-06/07/08. Le stockage Packing actif spécialisé n'est pas uniformisé ; seul son formulaire générique comprend le nouveau résultat et considère une version future comme une persistance dégradée.

Le document historique `ws-05-persistence-local-data-integrity.md` n'est pas réécrit : ses affirmations de « self-heal » décrivent une livraison historique et ne constituent pas la politique actuelle.

## Tests

- T10 : accès lecture/écriture, quota, sérialisation, schéma, parse et vérification renvoient des résultats typés sans faux succès ;
- T15 : JSON/schéma invalide et version future restent non destructifs ;
- T17 : StrictMode, mount et changement de clé n'écrivent pas de valeur initiale parasite ;
- T18 : non-régression Packing via sa suite existante et adaptation explicite du seul appel qui consomme le résultat du setter.

Les résultats CI et le SHA final sont ajoutés à la PR après exécution réelle.
