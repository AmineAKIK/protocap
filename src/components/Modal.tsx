import type { ReactNode } from 'react';
import { AccessibleDialog } from './AccessibleDialog';

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function Modal({ title, children, onClose }: ModalProps) {
  return (
    <AccessibleDialog
      title={title}
      onClose={onClose}
      className="!mb-[calc(0.75rem_+_env(safe-area-inset-bottom))] !mt-auto sm:!m-auto"
      contentClassName="p-4 sm:p-5"
    >
      {children}
    </AccessibleDialog>
  );
}
