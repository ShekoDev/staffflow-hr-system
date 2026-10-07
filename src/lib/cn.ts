type ClassValue = string | number | null | undefined | false | ClassValue[] | Record<string, boolean | undefined>;

/** Tiny class-name joiner — keeps components free of a runtime dependency. */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (value: ClassValue): void => {
    if (!value) return;
    if (typeof value === 'string' || typeof value === 'number') {
      out.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    for (const [key, enabled] of Object.entries(value)) {
      if (enabled) out.push(key);
    }
  };
  inputs.forEach(walk);
  return out.join(' ');
}
