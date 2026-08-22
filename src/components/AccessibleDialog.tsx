import { X } from 'lucide-react';
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from 'react';

interface AccessibleDialogProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  description?: string;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  titleClassName?: string;
  closeLabel?: string;
  hideCloseButton?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export function AccessibleDialog({
  title,
  children,
  onClose,
  description,
  className = '',
  contentClassName = '',
  headerClassName = '',
  titleClassName = '',
  closeLabel = 'Fermer',
  hideCloseButton = false,
  initialFocusRef,
}: AccessibleDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    if (!dialog.open) dialog.showModal();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }

      const firstFocusable = dialog.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      previousFocusRef.current?.focus();
    };
  }, [initialFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={`m-auto max-h-[calc(100dvh_-_1.5rem)] w-[calc(100%_-_1.5rem)] max-w-xl overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-2xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm ${className}`}
    >
      <div className={`flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 ${headerClassName}`}>
        <div className="min-w-0">
          <h2 id={titleId} className={`text-lg font-bold text-slate-950 ${titleClassName}`}>
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="mt-1 text-sm leading-6 text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
        {!hideCloseButton ? (
          <button
            type="button"
            className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-700/20"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <X size={20} />
          </button>
        ) : null}
      </div>
      <div className={`max-h-[calc(100dvh_-_6rem)] overflow-y-auto ${contentClassName}`}>
        {children}
      </div>
    </dialog>
  );
}
