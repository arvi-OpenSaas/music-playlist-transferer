export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '');
}

export function parseDurationSeconds(value: string): number {
  const match = value.match(/(\d+):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    return 0;
  }

  const [, minutes, seconds, hours] = match;
  const minuteValue = Number(minutes);
  const secondValue = Number(seconds);
  const hourValue = hours ? Number(hours) : 0;

  return hourValue * 3600 + minuteValue * 60 + secondValue;
}

export function toJsonString(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  const body = rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? '')).join(','));

  return [headers.join(','), ...body].join('\n');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
