# PR-08 — consommateurs transverses et concurrence locale

Base : `855d28b6e8f4dbfab431773ccbb6c9ba97cd2b7e` (PR-07 fusionnée).

## Contrat de concurrence

Une écriture durable compatible doit être exécutée sous un Web Lock de même origine, relire l’état courant dans la section critique, appliquer l’intention à cet état, vérifier la révision attendue puis vérifier l’écriture. Une file locale dans un seul onglet ne constitue pas une protection multi-onglets.

Si Web Locks est indisponible, les surfaces durables passent explicitement en lecture seule ou en mode mémoire dégradé déjà consenti. Aucune écriture durable n’est tentée « quand même ».

## Expiry

`lineops.expiry.aggregate.v1` devient une source de migration immuable. Le format actif est `lineops.expiry.aggregate.v2` avec `revision`. Les deux anciennes clés v8 restent également intactes. Le remplacement/recharge est revalidé avec l’heure et l’état relus **dans le verrou**. Deux onglets compatibles composent leurs opérations sans perdre l’historique.

## Logistics

`lineops.logistics.requests.v8` devient source de migration immuable. Le format actif `lineops.logistics.requests.v9` contient `schemaVersion: 9`, `revision` et `requests`. Chaque création ou transition relit v9 sous verrou avant de calculer la mutation.

Un ancien lecteur v8 qui voit v9 détecte déjà cette version comme future via le contrat PR-05 et doit rester en lecture seule. Le rollback vers un lecteur qui ignore v2/v9 est donc interdit après nouvelle écriture ; la récupération passe par un forward-fix capable de lire les formats actifs.

## Packing et ShiftGuide

Packing conserve son format spécialisé v3 et ses révisions. Quand Web Locks est absent, son adaptateur navigateur n’effectue plus d’écriture durable ; le mode dégradé mémoire et son consentement explicite restent inchangés.

ShiftGuide conserve ses namespaces, révisions, progression et données de session séparées. Le fallback de concurrence qui sérialisait seulement dans l’onglet courant est supprimé : sans Web Locks, une mutation de progression est ignorée et la bannière indique le mode lecture seule durable. Les données protégées de session ne sont pas déplacées vers le stockage public.

## Acceptation

- T17 : pas de réintroduction d’écritures parasites ;
- T18 : Packing conserve révisions, conflit et consentement dégradé ;
- T19 : session/logout/config/progression/Céline restent séparés ;
- T21 : identités de retry stables ;
- T23 : deux onglets Expiry et Logistics préservent leurs opérations, verrou annulable, absence de Web Locks explicite ;
- T40/T41 : migrations v1/v8 vers v2/v9 non destructives, reload stable, rollback ancien lecteur explicitement interdit ;
- T42/T43 : modes lecture seule annoncés et suites navigateurs existantes conservées.
