const pageClass =
  'mx-auto w-full max-w-[980px] overflow-hidden bg-white shadow-[0_18px_60px_rgba(15,23,42,0.10)] ring-1 ring-slate-200';

function DocumentHeader({ page }: { page: number }) {
  return (
    <>
      <div className="flex items-center justify-between gap-4 text-[10px] font-semibold text-slate-500 sm:text-xs">
        <span>S.P.I. | Proposition d’essai pilote</span>
        <span>Document de travail - Version 0.1 - 21 août 2026 | Page {page} / 3</span>
      </div>
      <div className="mt-3 h-px bg-slate-200" />
    </>
  );
}

function DocumentFooter({ page }: { page: number }) {
  return (
    <div className="mt-auto pt-8 text-center text-[9px] text-slate-400 sm:text-[10px]">
      Document de travail - Version 0.1 - 21 août 2026 &nbsp; | &nbsp; Page {page} / 3
    </div>
  );
}

function SectionBand({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-[#bfd3dc] bg-[#eaf3f6] px-4 py-1.5 text-center text-[11px] font-black uppercase tracking-wide text-[#174b67] sm:text-xs">
      {children}
    </div>
  );
}

function NumberedTitle({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <h2 className="mt-3 text-xl font-black tracking-tight text-[#163f5b] sm:text-2xl">
      {number}. {children}
    </h2>
  );
}

function StepRow({ number, label, children, tone = 'teal' }: { number: number; label: string; children: React.ReactNode; tone?: 'teal' | 'navy' }) {
  return (
    <div className="grid grid-cols-[7.8rem_minmax(0,1fr)] border-x border-b border-slate-200 text-[11px] leading-5 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:text-sm">
      <div className={`${tone === 'navy' ? 'bg-[#183f68]' : 'bg-[#117b80]'} px-3 py-2 text-center font-black text-white`}>
        {number}&nbsp; {label}
      </div>
      <div className="bg-[#f8fafc] px-3 py-2 text-slate-700">{children}</div>
    </div>
  );
}

export function PilotProposalPage() {
  return (
    <div className="bg-[#eef2f5] px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="space-y-6 sm:space-y-10">
        <section className={`${pageClass} flex min-h-[1385px] flex-col px-5 py-5 sm:px-10 sm:py-7 lg:px-14`}>
          <DocumentHeader page={1} />

          <SectionBand>PROPOSITION D’AMÉLIORATION - PÉRIMÈTRE PILOTE</SectionBand>

          <div className="mt-4">
            <h1 className="max-w-4xl text-3xl font-black leading-[1.03] tracking-tight text-[#163f5b] sm:text-5xl">
              Assistant de rappel des prélèvements en production
            </h1>
            <p className="mt-4 max-w-4xl text-sm font-medium leading-6 text-slate-700 sm:text-lg sm:leading-8">
              Utiliser les événements déjà déclarés dans S.P.I. pour afficher le bon prélèvement, au bon moment, sans modifier S.P.I.
            </p>
            <p className="mt-3 text-[11px] font-bold text-slate-500 sm:text-sm">
              Proposition élaborée par : AKIK Mohamed Amine • Hugo JULIEN
            </p>
            <div className="mt-5 bg-[#173f68] px-4 py-2.5 text-center text-xs font-black uppercase tracking-wide text-white sm:text-sm">
              OBJECTIF : obtenir l’autorisation d’un essai contrôlé sur une ligne pilote.
            </div>
          </div>

          <NumberedTitle number={1}>Constat opérationnel</NumberedTitle>
          <p className="mt-2 text-[12px] leading-5 text-slate-700 sm:text-[15px] sm:leading-6">
            Certains événements de production déclenchent des prélèvements définis par les règles métier. Aujourd’hui, l’événement est déjà déclaré dans S.P.I., mais le lien entre cet événement et le prélèvement attendu repose encore largement sur la vigilance de l’opérateur.
          </p>
          <ul className="mt-3 space-y-1.5 pl-5 text-[12px] leading-5 text-slate-700 marker:text-[#117b80] sm:text-[15px] sm:leading-6">
            <li>Des oublis de prélèvements sont observés en production.</li>
            <li>Les événements déclencheurs sont déjà signalés dans S.P.I. : changement, début/fin de séquence, arrêt prolongé, etc.</li>
            <li>Les prélèvements à réaliser peuvent varier selon la ligne : la règle doit donc être configurable par ligne, et non codée en dur.</li>
          </ul>
          <p className="mt-3 text-[12px] font-semibold leading-5 text-slate-800 sm:text-[15px] sm:leading-6">
            L’opportunité n’est pas de créer une nouvelle saisie : elle est d’utiliser un signal déjà présent pour rappeler automatiquement l’action attendue.
          </p>

          <NumberedTitle number={2}>Principe proposé</NumberedTitle>
          <div className="mt-3 grid overflow-hidden border border-slate-200 md:grid-cols-2">
            <div className="border-b border-slate-200 md:border-b-0 md:border-r">
              <div className="bg-[#f1f3f5] px-4 py-2 text-center text-xs font-black uppercase tracking-wide text-slate-600">AUJOURD’HUI</div>
              <div className="flex min-h-36 items-center justify-center px-5 py-4 text-center text-sm font-semibold leading-7 text-slate-700 sm:text-base">
                Événement déclaré dans S.P.I.<br />
                &gt; l’opérateur doit se souvenir de la règle<br />
                &gt; prélèvement
              </div>
            </div>
            <div>
              <div className="bg-[#dff2f1] px-4 py-2 text-center text-xs font-black uppercase tracking-wide text-[#117b80]">AVEC LE PILOTE</div>
              <div className="flex min-h-36 items-center justify-center px-5 py-4 text-center text-sm font-semibold leading-7 text-slate-700 sm:text-base">
                Événement déclaré dans S.P.I.<br />
                &gt; règle de la ligne identifiée automatiquement<br />
                &gt; rappel persistant<br />
                &gt; validation opérateur
              </div>
            </div>
          </div>

          <NumberedTitle number={3}>Valeur attendue</NumberedTitle>
          <div className="mt-3 grid border-l border-t border-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Moins d’oublis', 'Rappel déclenché à partir de l’événement déjà signalé.'],
              ['Instruction claire', 'La fenêtre indique le prélèvement attendu pour la ligne concernée.'],
              ['Changement limité', 'S.P.I. reste inchangé ; le dispositif est complémentaire et réversible.'],
              ['Déploiement progressif', 'Un moteur commun, avec des règles configurables ligne par ligne.'],
            ].map(([title, text]) => (
              <div key={title} className="border-b border-r border-slate-200 px-4 py-4">
                <h3 className="text-sm font-black text-[#163f5b]">{title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-slate-600 sm:text-sm">{text}</p>
              </div>
            ))}
          </div>

          <DocumentFooter page={1} />
        </section>

        <section className={`${pageClass} flex min-h-[1385px] flex-col px-5 py-5 sm:px-10 sm:py-7 lg:px-14`}>
          <DocumentHeader page={2} />

          <SectionBand>FONCTIONNEMENT DU PILOTE</SectionBand>
          <NumberedTitle number={4}>Fonctionnement proposé</NumberedTitle>
          <p className="mt-2 text-[12px] leading-5 text-slate-700 sm:text-[15px] sm:leading-6">
            Le pilote se limite volontairement à une boucle simple : détecter un événement pertinent, identifier la règle associée à la ligne, afficher le rappel et maintenir ce rappel jusqu’à une action explicite de l’opérateur.
          </p>

          <div className="mt-3 border-t border-slate-200">
            <StepRow number={1} label="S.P.I." tone="navy">Source de l’événement - S.P.I. reste inchangé.</StepRow>
            <StepRow number={2} label="Détection">Lecture autorisée des informations utiles : ligne, type d’événement, horaire/durée selon le cas.</StepRow>
            <StepRow number={3} label="Règle">Le moteur consulte un référentiel configurable par ligne : événement + condition &gt; prélèvement attendu.</StepRow>
            <StepRow number={4} label="Rappel">Une fenêtre persistante affiche l’événement et le prélèvement à réaliser. Elle ne disparaît pas sans action opérateur.</StepRow>
            <StepRow number={5} label="Validation" tone="navy">L’opérateur confirme « Prélèvement effectué ». Le rappel est alors acquitté.</StepRow>
          </div>

          <h3 className="mt-4 text-sm font-black text-[#117b80] sm:text-base">Exemple d’expérience opérateur (illustratif)</h3>
          <div className="mt-2 grid border border-slate-200 md:grid-cols-2">
            <div className="border-b border-[#d6a532] bg-[#fff8e8] p-4 md:border-b-0 md:border-r">
              <p className="text-center text-sm font-black text-[#7b6416] sm:text-base">PRÉLÈVEMENT REQUIS</p>
              <div className="mt-3 space-y-1 text-xs text-slate-700 sm:text-sm">
                <p><strong>Ligne :</strong> L108</p>
                <p><strong>Événement :</strong> Arrêt prolongé &gt; 4 h</p>
                <p><strong>À réaliser :</strong> 5 PF - Microbiologie</p>
              </div>
              <div className="mt-5 bg-[#173f68] px-4 py-2 text-center text-xs font-black text-white sm:text-sm">PRÉLÈVEMENT EFFECTUÉ</div>
            </div>
            <div className="bg-[#e9f5f5] p-4 text-center">
              <h4 className="text-sm font-black leading-5 text-[#117b80] sm:text-base">Une seule logique, des règles adaptées à chaque ligne</h4>
              <p className="mt-3 text-left text-xs leading-5 text-slate-700 sm:text-sm">
                Les prélèvements ne sont pas codés dans le programme. Le système charge un référentiel configurable par ligne, versionné et validé par les métiers.
              </p>
              <p className="mt-2 text-left text-xs leading-5 text-slate-700 sm:text-sm">
                Ainsi, une évolution de règle ne nécessite pas de modifier la logique générale du dispositif.
              </p>
            </div>
          </div>

          <NumberedTitle number={5}>Principes de robustesse et garde-fous</NumberedTitle>
          <div className="mt-3 grid border-l border-t border-slate-200 sm:grid-cols-2">
            {[
              ['S.P.I. protégé', 'Aucune modification ni écriture dans S.P.I. Le mode d’accès définitif est validé par l’IT.'],
              ['Défaillance isolée', 'Si le dispositif de rappel est indisponible, S.P.I. et la ligne continuent de fonctionner normalement.'],
              ['Mémoire d’état minimale', 'Un rappel actif doit survivre à un redémarrage du poste ou du service jusqu’à son acquittement.'],
              ['Pas de doublons', 'Un même événement ne doit pas générer plusieurs rappels identiques.'],
              ['Référentiel maîtrisé', 'Règles par ligne avec version/date d’effet et validation métier avant activation.'],
              ['Validation ≠ preuve qualité', 'Le clic confirme une déclaration opérateur ; il ne constitue pas, à lui seul, une preuve physique du prélèvement.'],
            ].map(([title, text]) => (
              <div key={title} className="border-b border-r border-slate-200 bg-[#f8fafc] px-4 py-3">
                <h3 className="text-xs font-black text-[#163f5b] sm:text-sm">{title}</h3>
                <p className="mt-1 text-[11px] leading-5 text-slate-600 sm:text-[13px]">{text}</p>
              </div>
            ))}
          </div>
          <div className="border-x border-b border-[#bfd3dc] bg-[#eaf3f6] px-4 py-2 text-[11px] leading-5 text-[#24556f] sm:text-[13px]">
            Faisabilité observée : S.P.I. présente déjà les informations utiles sous une forme structurée (ligne, état, type d’arrêt, horaire, durée, dernière modification). Cela rend un pilote crédible, sous réserve de validation IT du mode d’accès retenu.
          </div>

          <DocumentFooter page={2} />
        </section>

        <section className={`${pageClass} flex min-h-[1385px] flex-col px-5 py-5 sm:px-10 sm:py-7 lg:px-14`}>
          <DocumentHeader page={3} />

          <SectionBand>PILOTE CONTRÔLÉ ET ÉVOLUTIONS</SectionBand>
          <NumberedTitle number={6}>Périmètre initial volontairement limité</NumberedTitle>
          <div className="mt-3 grid border border-slate-200 md:grid-cols-2">
            <div className="border-b border-slate-200 bg-[#eef8e8] p-4 md:border-b-0 md:border-r">
              <h3 className="text-center text-xs font-black uppercase tracking-wide text-[#527d48] sm:text-sm">INCLUS DANS LE PILOTE</h3>
              <ul className="mt-3 space-y-1.5 pl-5 text-xs leading-5 text-slate-700 sm:text-sm">
                <li>Une ligne pilote</li>
                <li>Un nombre limité d’événements déclencheurs validés</li>
                <li>Règles configurables propres à la ligne</li>
                <li>Fenêtre persistante</li>
                <li>Validation explicite par l’opérateur</li>
                <li>Mémoire d’état minimale pour la robustesse</li>
              </ul>
            </div>
            <div className="bg-[#f7f8fa] p-4">
              <h3 className="text-center text-xs font-black uppercase tracking-wide text-slate-600 sm:text-sm">HORS PÉRIMÈTRE INITIAL</h3>
              <ul className="mt-3 space-y-1.5 pl-5 text-xs leading-5 text-slate-700 sm:text-sm">
                <li>Historique métier détaillé</li>
                <li>Traçabilité opérateur / identité</li>
                <li>Dashboard et indicateurs</li>
                <li>Relances / escalades hiérarchiques</li>
                <li>Réconciliation avec les systèmes qualité</li>
                <li>Déploiement multi-lignes</li>
              </ul>
            </div>
          </div>

          <NumberedTitle number={7}>Déroulement recommandé de l’essai</NumberedTitle>
          <div className="mt-3 border-t border-slate-200">
            <StepRow number={1} label="Cadrer" tone="navy">Production / Qualité valident les événements, seuils et prélèvements. L’IT valide le principe d’accès et les contraintes poste/réseau.</StepRow>
            <StepRow number={2} label="Démontrer">Présenter une démonstration hors production avec des événements simulés afin de valider l’ergonomie et les règles avant tout raccordement.</StepRow>
            <StepRow number={3} label="Essayer">Installer le dispositif sur une seule ligne, sur une durée courte à convenir, avec un périmètre explicitement approuvé.</StepRow>
            <StepRow number={4} label="Décider" tone="navy">Revue conjointe des résultats : utilité opérationnelle, robustesse, impact utilisateur et conditions éventuelles de poursuite.</StepRow>
          </div>

          <h3 className="mt-4 text-sm font-black text-[#117b80] sm:text-base">Critères de réussite proposés</h3>
          <div className="mt-2 grid border-l border-t border-slate-200 sm:grid-cols-2">
            {[
              '✓ Chaque scénario validé déclenche le bon rappel.',
              '✓ Aucun rappel en double pour un même événement.',
              '✓ Un rappel non acquitté réapparaît après redémarrage.',
              '✓ Aucune dégradation du fonctionnement de S.P.I. ou de la ligne.',
              '✓ Le message est compris rapidement par les opérateurs.',
              '✓ La revue du pilote permet une décision factuelle : poursuivre, ajuster ou arrêter.',
            ].map((item) => (
              <div key={item} className="border-b border-r border-slate-200 px-3 py-2 text-[11px] leading-5 text-slate-700 sm:text-[13px]">{item}</div>
            ))}
          </div>

          <NumberedTitle number={8}>Évolutions possibles si le pilote démontre sa valeur</NumberedTitle>
          <p className="mt-2 text-[11px] leading-5 text-slate-700 sm:text-[13px]">
            Ces fonctions sont volontairement exclues du premier essai afin de conserver un périmètre simple. Elles peuvent être ajoutées ultérieurement sans remettre en cause le principe initial : traçabilité des acquittements, historique, délais de réalisation, relances et escalades, tableaux de bord, centralisation multi-lignes, rapprochement avec les systèmes de prélèvement/qualité.
          </p>

          <div className="mt-4 bg-[#173f68] px-5 py-4 text-center text-white">
            <p className="text-xs font-black uppercase tracking-wide sm:text-sm">DÉCISION DEMANDÉE</p>
            <p className="mt-1 text-sm font-black leading-5 sm:text-base sm:leading-6">
              Autoriser une étude courte avec l’IT, Production et Qualité et, si les conditions sont validées, un essai contrôlé sur une ligne pilote.
            </p>
            <p className="mt-2 text-[11px] text-slate-200 sm:text-xs">
              Cette demande ne constitue pas une autorisation de déploiement généralisé.
            </p>
          </div>

          <DocumentFooter page={3} />
        </section>
      </div>
    </div>
  );
}
