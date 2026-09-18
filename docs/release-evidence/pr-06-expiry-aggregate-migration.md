# PR-06 — agrégat Expiry, historique et migration

Base : `bdc85ae1afebef6dbc06c011907756081f89d9f4` (PR-05 fusionnée).

## Décision de format

PR-06 remplace les deux écritures actives `lineops.expiry.lines.v8` + `lineops.expiry.history.v8` par une seule clé `lineops.expiry.aggregate.v1` contenant `{ schemaVersion: 1, lines, history }`.

Les deux clés v8 sont des **sources de migration conservées** : elles ne sont ni effacées, ni normalisées, ni remises à l’heure. Une migration réussie les laisse byte-for-byte intactes. Après activation de l’agrégat, elles deviennent volontairement figées et ne sont plus miroir de l’état courant.

Conséquence de rollback : un simple `git revert` vers l’ancien lecteur n’est **pas sûr**, car il relirait des clés v8 devenues anciennes. Le retour arrière est interdit sans procédure de récupération/forward-fix capable de relire l’agrégat. PR-08/13 conservent T40/T41 pour la coordination et la procédure finale.

## Contrat

- migration v8 → agrégat idempotente et reprenable ;
- agrégat invalide, source partielle/corrompue ou version future : aucune réécriture destructive ; lecture prudente et mutations bloquées ;
- un remplacement ou une recharge écrit l’état et sa trace dans **un seul `setItem`** ou ne confirme rien ;
- l’écriture relit exactement l’agrégat avant succès ;
- en cas de résultat de vérification incertain, le retry réutilise l’identité de l’opération et reconnaît l’agrégat déjà écrit afin de ne pas dupliquer l’historique ;
- les collisions/conflits visibles passent en récupération requise au lieu d’écraser une version différente ;
- les traces orphelines ou aux dates suspectes restent visibles telles quelles, sans correction globale `+2 h`.

La course entre deux onglets après la relecture et avant `setItem` n’est pas prétendue résolue ici : Web Locks, révisions et coordination restent PR-08.

## Acceptation

- T13 : état + trace ensemble ou aucun ;
- T14 : migration des deux clés v8 idempotente, reprenable, sources préservées ;
- T15/T16 : corruption/version future/orphelins conservés sans faux historique ;
- T21 : retry à identité stable sans doublon ;
- T42/T43 : erreurs et lecture seule annoncées de façon accessible sur desktop/mobile/WebKit.

Les résultats CI, SHA final et revue critique seront ajoutés à la PR après exécution réelle.
