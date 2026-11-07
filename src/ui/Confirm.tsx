import { useCallback, useState, type ReactNode } from 'react';
import { Modal } from './Sheet';

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

/** const [confirmUi, ask] = useConfirm(); if (await ask({...})) … */
export function useConfirm(): [ReactNode, (o: ConfirmOptions) => Promise<boolean>] {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const ask = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })),
    [],
  );

  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };

  const ui = state ? (
    <Modal
      title={state.title}
      actions={
        <>
          <button className="btn" onClick={() => close(false)}>
            {state.cancelLabel ?? 'Abbrechen'}
          </button>
          <button className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>
            {state.confirmLabel ?? 'OK'}
          </button>
        </>
      }
    >
      {state.message}
    </Modal>
  ) : null;

  return [ui, ask];
}
