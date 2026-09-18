import { X } from 'lucide-react';
import {
  type KeyboardEvent,
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
  shouldRestoreFocus?: () => boolean;
}

function handleContentPageKey(event: KeyboardEvent<HTMLDivElement>) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
    || (event.key !== 'PageUp' && event.key !== 'PageDown')) return;

  const region = event.currentTarget;
  const target = event.target;
  // Some engines do not page-scroll a container while one of its buttons is focused.
  // Leave text editing, select navigation and custom widgets to their native owners.
  if (!(target instanceof HTMLElement)
    || (target !== region && !target.closest('button, a[href]'))) return;
  if (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;

  // A nested scrolling surface owns its own keys, even when it contains a button.
  for (let element: HTMLElement | null = target; element && element !== region; element = element.parentElement) {
    if (element.scrollHeight > element.clientHeight && /^(auto|scroll)$/.test(getComputedStyle(element).overflowY)) return;
  }
  const height = region.clientHeight;
  const maximum = region.scrollHeight - height;
  if (height <= 0 || maximum <= 0) return;

  event.preventDefault();
  const direction = event.key === 'PageDown' ? 1 : -1;
  region.scrollTop = Math.max(0, Math.min(maximum, region.scrollTop + direction * height));
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
  shouldRestoreFocus,
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

      const previousFocus = previousFocusRef.current;
      if ((shouldRestoreFocus?.() ?? true) && previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, [initialFocusRef, shouldRestoreFocus]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={`m-auto w-[calc(100%_-_1.5rem)] max-w-xl overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-2xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm ${className}`}
    >
      <div className="grid max-h-[calc(100dvh_-_1.5rem)] min-h-0 grid-rows-[auto_minmax(0,1fr)]">
        <div className={`flex min-w-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:items-center ${headerClassName}`}>
          <div className="min-w-0">
            <h2 id={titleId} className={`break-normal text-lg font-bold text-slate-950 ${titleClassName}`}>
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 break-normal text-sm leading-6 text-slate-500">
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
        <div
          role="region"
          aria-labelledby={titleId}
          tabIndex={0}
          onKeyDown={handleContentPageKey}
          className={`min-h-0 overflow-y-auto overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 ${contentClassName}`}
        >
          {children}
        </div>
      </div>
    </dialog>
  );
}
