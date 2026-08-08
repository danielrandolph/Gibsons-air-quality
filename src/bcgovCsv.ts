export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

// DATE_PST looks like "2026-08-07 09:00" in Pacific time; treat as PDT (UTC-7) since that's
// the only season wildfire smoke is a concern here.
export function parsePstToIso(datePst: string): string | undefined {
  if (!datePst) return undefined;
  const iso = datePst.trim().replace(' ', 'T') + ':00-07:00';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
