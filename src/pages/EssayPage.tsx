import { BookOpen, Download, FileText } from 'lucide-react';
import { PageFrame } from '../components/PageFrame';

const PDF_PATH = '/rendre-l-attention-au-reel-akik-mohamed-amine.pdf';

const actionClassName =
  'inline-flex min-h-11 max-w-full min-w-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-center text-sm font-semibold leading-5 transition focus-visible:outline-none focus-visible:ring-4';

export function EssayPage() {
  return (
    <div className="bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <PageFrame className="py-10 sm:py-14 lg:py-16">
          <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)] lg:items-start lg:gap-12">
            <div className="min-w-0">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-teal-800">
                <FileText size={14} aria-hidden="true" />
                Pensée systémique · Essai
              </div>

              <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
                Rendre l’attention au réel
              </h1>
              <p className="mt-4 max-w-2xl text-lg font-semibold leading-8 text-slate-700">
                Technologie, travail et maîtrise des systèmes
              </p>
              <p className="mt-3 text-sm font-medium text-slate-500">Un essai de AKIK Mohamed Amine · AkikSystems</p>

              <div className="mt-8 max-w-3xl space-y-4 text-base leading-7 text-slate-600">
                <p>
                  De l’expérience du terrain à ProtoCap et Céline : concevoir des systèmes qui préservent l’attention et développent la capacité d’agir.
                </p>
                <p>
                  L’essai développe la réflexion à l’origine de ProtoCap : distinguer l’effort mental qui construit la maîtrise de celui qui compense les limites de l’organisation ou de ses outils, puis examiner ce que la technologie peut réellement déplacer sans appauvrir le travail.
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={PDF_PATH}
                  target="_blank"
                  rel="noreferrer"
                  className={`${actionClassName} bg-teal-700 text-white hover:bg-teal-800 focus-visible:ring-teal-700/20`}
                >
                  <BookOpen size={17} className="shrink-0" aria-hidden="true" />
                  <span className="min-w-0">Lire le PDF</span>
                </a>
                <a
                  href={PDF_PATH}
                  download="rendre-l-attention-au-reel-akik-mohamed-amine.pdf"
                  className={`${actionClassName} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-900/10`}
                >
                  <Download size={17} className="shrink-0" aria-hidden="true" />
                  <span className="min-w-0">Télécharger le PDF</span>
                </a>
              </div>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Document original · 25 pages · le fichier PDF est proposé sans retranscription ni modification de sa mise en page.
              </p>
            </div>

            <figure className="mx-auto w-full max-w-sm lg:mx-0 lg:justify-self-end">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#f7f5ee] shadow-xl shadow-slate-200/60">
                <img
                  src="/rendre-l-attention-au-reel-cover.png"
                  alt="Couverture de l’essai Rendre l’attention au réel"
                  className="block h-auto w-full"
                  loading="eager"
                />
              </div>
              <figcaption className="mt-3 text-center text-xs leading-5 text-slate-500">
                Couverture du document original
              </figcaption>
            </figure>
          </div>
        </PageFrame>
      </section>
    </div>
  );
}
