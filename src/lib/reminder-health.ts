export type HealthTone = "ready" | "attention";

export function healthSummary(input: {
  failed_occurrences: number;
  stale_occurrences: number;
}): { tone: HealthTone; label: string } {
  const attention = input.failed_occurrences + input.stale_occurrences;
  if (attention === 0)
    return { tone: "ready", label: "Pengiriman berjalan normal" };
  return { tone: "attention", label: `${attention} pengiriman perlu diperiksa` };
}
