import { useEffect, useId, useRef } from 'react';
import { useI18n } from '../i18n';
import './confirmation-dialog.css';

interface ConfirmationDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** Opening a confirmation never performs the action; only its confirm button does. */
export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const { t } = useI18n();
  const dialogId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    cancelButton.current?.focus();
    return () => {
      element.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="confirmation-dialog"
      aria-labelledby={`${dialogId}-title`}
      aria-describedby={`${dialogId}-description`}
      onKeyDown={(event) => {
        if (!open || event.key !== 'Tab') return;
        if (event.shiftKey && document.activeElement === cancelButton.current) {
          event.preventDefault();
          confirmButton.current?.focus();
        } else if (!event.shiftKey && document.activeElement === confirmButton.current) {
          event.preventDefault();
          cancelButton.current?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id={`${dialogId}-title`}>{title}</h2>
      <p id={`${dialogId}-description`}>{description}</p>
      <div className="confirmation-dialog-actions">
        <button
          ref={cancelButton}
          className="confirmation-dialog-cancel"
          type="button"
          onClick={onCancel}
        >
          {cancelLabel ?? t('取消')}
        </button>
        <button
          ref={confirmButton}
          className="confirmation-dialog-confirm"
          type="button"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
