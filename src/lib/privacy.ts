const listeners = new Set<() => void>();
/** Hard-coded hidden on mount — values stay masked until the user taps the eye. */
let memory = true;

function emit() {
  listeners.forEach((l) => l());
}

export function getHideBalances(): boolean {
  return memory;
}

export function setHideBalances(hide: boolean): void {
  memory = hide;
  emit();
}

export function toggleHideBalances(): void {
  setHideBalances(!getHideBalances());
}

export function subscribeHideBalances(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
