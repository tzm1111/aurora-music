import { useEffect, useLayoutEffect, useRef } from 'react';

const dialogs: HTMLElement[] = [];
// 只让最上层弹窗处理键盘；关闭后回到原来的操作按钮。
export function useDialogFocus(onClose: () => void, restoreSelector?: string) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useLayoutEffect(() => { close.current = onClose; });
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogs.push(root);
    const focusables = () => [...root.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length > 0);
    (focusables()[0] || root).focus();
    const onKey = (event: KeyboardEvent) => {
      if (dialogs.at(-1) !== root) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current(); }
      if (event.key === 'Tab') {
        const items = focusables();
        const first = items[0], last = items.at(-1);
        if (!first) { event.preventDefault(); root.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    const keepFocus = (event: FocusEvent) => {
      if (dialogs.at(-1) === root && !root.contains(event.target as Node)) (focusables()[0] || root).focus();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', keepFocus);
    return () => {
      dialogs.splice(dialogs.indexOf(root), 1);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', keepFocus);
      if (previous?.isConnected) previous.focus();
      else if (restoreSelector) document.querySelector<HTMLElement>(restoreSelector)?.focus();
    };
  }, [restoreSelector]);
  return ref;
}
