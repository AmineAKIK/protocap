import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center">
      <div className="max-h-[calc(100dvh_-_1.5rem)] w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <button
            type="button"
            className="grid min-h-11 min-w-11 place-items-center rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[calc(100dvh_-_6rem)] overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
