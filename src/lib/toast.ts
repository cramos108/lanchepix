export type ToastKind = "ok" | "err" | "info";
export type Toast = { id: number; text: string; kind: ToastKind };

type Listener = (toast: Toast) => void;

const listeners = new Set<Listener>();
let seq = 1;

export function toast(text: string, kind: ToastKind = "ok"): void {
  const event: Toast = { id: seq++, text, kind };
  listeners.forEach((listener) => listener(event));
}

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
