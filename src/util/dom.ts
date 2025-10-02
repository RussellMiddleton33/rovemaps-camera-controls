export type ListenerOptions = boolean | AddEventListenerOptions;

export function on<K extends keyof HTMLElementEventMap>(
  el: HTMLElement | Window | Document,
  type: K,
  listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
  options?: ListenerOptions
) {
  el.addEventListener(type, listener as any, options);
  return () => off(el, type, listener as any, options);
}

export function off<K extends keyof HTMLElementEventMap>(
  el: HTMLElement | Window | Document,
  type: K,
  listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
  options?: ListenerOptions
) {
  el.removeEventListener(type, listener as any, options);
}

