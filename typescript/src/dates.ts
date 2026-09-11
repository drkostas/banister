/** Whole days between two YYYY-MM-DD dates (b minus a). Local-midnight arithmetic, rounded. */
export function daysBetween(a: string, b: string): number {
  const msA = new Date(a + "T00:00:00").getTime();
  const msB = new Date(b + "T00:00:00").getTime();
  return Math.round((msB - msA) / 86_400_000);
}
