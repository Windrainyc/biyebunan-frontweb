import type { ObjectDirective } from 'vue';
/** 弹窗将键盘焦点限制在自身，关闭后返回触发按钮，避免键盘用户误触背景。 */
const contexts = new WeakMap<
  HTMLElement,
  { previous: HTMLElement | null; listener: (event: KeyboardEvent) => void }
>();
export const dialog: ObjectDirective<HTMLElement, () => void> = {
  mounted(element, binding) {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ),
      ).filter((e) => e.getClientRects().length && getComputedStyle(e).opacity !== '0');
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        binding.value();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = focusable(),
        first = nodes[0],
        last = nodes[nodes.length - 1];
      if (!first) {
        event.preventDefault();
        element.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || !element.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !element.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    element.setAttribute('tabindex', '-1');
    element.addEventListener('keydown', listener);
    contexts.set(element, { previous, listener });
    queueMicrotask(() => {
      (focusable()[0] || element).focus();
    });
  },
  unmounted(element) {
    const context = contexts.get(element);
    if (!context) return;
    element.removeEventListener('keydown', context.listener);
    if (context.previous?.isConnected) context.previous.focus();
    contexts.delete(element);
  },
};
