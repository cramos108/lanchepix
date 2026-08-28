const KEY = "privacy_hide_balances";

const listeners = new Set<() => void>();
let memory = true;
let booted = false;

function readStored(): boolean {
  try {
    const value = localStorage.getItem(KEY);
    if (value === null) return true;
    return value === "true";
  } catch {
    return true;
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export function getHideBalances(): boolean {
  if (typeof window === "undefined") return true;
  if (!booted) {
    memory = readStored();
    booted = true;
  }
  return memory;
}

export function setHideBalances(hide: boolean): void {
  memory = hide;
  booted = true;
  try {
    localStorage.setItem(KEY, hide ? "true" : "false");
  } catch {
    /* private mode */
  }
  emit();
}

export function toggleHideBalances(): void {
  setHideBalances(!getHideBalances());
}

export function subscribeHideBalances(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
