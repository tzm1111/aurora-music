import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useDialogFocus } from '../lib/useDialogFocus';

export function Dialog({ children, onClose, label, backdropClass = 'connection-backdrop', panelClass = 'connection-dialog' }: { children: ReactNode; onClose: () => void; label: string; backdropClass?: string; panelClass?: string }) {
  const ref = useDialogFocus(onClose);
  return createPortal(<motion.div className={backdropClass} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .18 }} onClick={onClose}>
    <motion.div ref={ref} className={panelClass} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22, ease: 'easeOut' }} onClick={e => e.stopPropagation()}>{children}</motion.div>
  </motion.div>, document.body);
}
