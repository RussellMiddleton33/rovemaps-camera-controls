export type Listener = (ev?: any) => void;

export class Evented<TEvents extends Record<string, any> = any> {
  private listeners: Map<keyof TEvents | string, Set<Listener>> = new Map();

  on<K extends keyof TEvents & string>(type: K, fn: (ev: TEvents[K]) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn as Listener);
    return this;
  }

  once<K extends keyof TEvents & string>(type: K, fn: (ev: TEvents[K]) => void) {
    const wrapped = (ev: TEvents[K]) => {
      this.off(type, wrapped as any);
      fn(ev);
    };
    return this.on(type, wrapped as any);
  }

  off<K extends keyof TEvents & string>(type: K, fn: (ev: TEvents[K]) => void) {
    const set = this.listeners.get(type);
    if (set) set.delete(fn as unknown as Listener);
    return this;
  }

  fire<K extends keyof TEvents & string>(type: K, ev: TEvents[K]) {
    const set = this.listeners.get(type);
    if (!set || set.size === 0) return this;
    // Iterate directly without array allocation for better performance
    // Safe mutation: listeners can only remove themselves, which Set.forEach handles
    set.forEach((fn) => {
      try {
        fn(ev);
      } catch (e) {
        // swallow to avoid breaking others; real impl may rethrow via onError
        // eslint-disable-next-line no-console
        console.error(e);
      }
    });
    return this;
  }
}

