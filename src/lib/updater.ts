export interface UpdateInfo {
  available: boolean;
  version: string | null;
  notes: string | null;
  date: string | null;
}

export interface UpdateProgressPayload {
  event: "Started" | "Progress" | "Finished";
  downloaded: number;
  total: number | null;
}

export function normalizeVersionLabel(version: string): string {
  const clean = version.trim().replace(/^v+/i, "");
  return `v${clean}`;
}

export function computeProgressPercent(
  downloaded: number,
  total: number | null,
): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((downloaded / total) * 100)));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
