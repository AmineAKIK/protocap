# PR-04 — actualisation Expiry et indicateurs cohérents

Base : `1cd27d8f4920ef528d92e68c2635f43c0764799d` (PR-03 fusionnée).

## Périmètre

PR-04 traite F03 et les portions Expiry de F04/F18/F22 avec T06/T07/T08/T09/T36/T42/T43. Elle ne modifie ni le format de stockage, ni l'atomicité des écritures, ni la coordination multi-onglets : ces sujets restent PR-05/06/08.

## Contrat

Une seule horloge React alimente les statuts, compteurs, badges, textes de temps restant, barre de progression et board Expiry. Le tick normal est d'une seconde, conformément au hook préexistant. Un retour visible, un focus de fenêtre ou un `pageshow` force une remise à l'heure immédiate afin de ne pas dépendre d'un timer potentiellement suspendu.

Les calculs métier reçoivent explicitement le même objet `Date` à chaque rendu. La soumission d'un formulaire ne fait toutefois pas confiance au dernier tick : `prepareDeclaration` reçoit un nouveau `Date` au clic et revalide l'état courant avant toute écriture. Un formulaire resté ouvert au passage de l'expiration conserve donc son brouillon mais une recharge devenue interdite est refusée.

L'état `unknown` reste distinct d'une expiration : présentation neutre, jamais verte et jamais rouge « expiré ». Les libellés de validité indiquent explicitement « calcul local » et « validité estimée ». La recharge est désactivée lorsque le bloc est expiré ou indéterminé.

## Vérifications prévues

- T06 : passage conforme → vigilance à 48 h → expiré sans interaction, avec compteurs et badges concordants et aucune écriture stockage.
- T07 : intervalle, retour visible, focus, pageshow et nettoyage complet des timers/écouteurs.
- T08 : formulaire de recharge ouvert avant expiration puis soumis après expiration, revalidé sans écriture.
- T43 : le parcours de refresh est ajouté au fichier E2E Expiry déjà sélectionné dans la Quality Gate pour Chromium, Chromium mobile et WebKit.

Les résultats finaux, SHA et runs sont consignés dans la PR après exécution ; ce document n'anticipe pas un résultat vert.
