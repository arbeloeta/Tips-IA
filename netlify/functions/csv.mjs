export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = splitLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    if (cells.length < 2) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = cells[idx] !== undefined ? cells[idx].trim() : "";
    });
    rows.push(row);
  }
  return rows;
}

function splitLine(line) {
  // separador simple por comas; los CSV de football-data.co.uk no llevan
  // comas dentro de los campos relevantes (nombres de equipo, fechas, goles)
  return line.split(",");
}

export function parseDateUK(s) {
  // formatos dd/mm/yy o dd/mm/yyyy
  if (!s) return null;
  const parts = s.split("/");
  if (parts.length !== 3) return null;
  let [d, m, y] = parts.map((p) => parseInt(p, 10));
  if (y < 100) y += y < 50 ? 2000 : 1900;
  const date = new Date(Date.UTC(y, m - 1, d));
  return isNaN(date.getTime()) ? null : date;
}

export function parseDateTimeEU(s) {
  // formato "dd/mm/yyyy HH:MM" (fixturedownload.com)
  if (!s) return null;
  const [datePart, timePart] = s.trim().split(" ");
  const dateParts = datePart.split("/");
  if (dateParts.length !== 3) return null;
  const [d, m, y] = dateParts.map((p) => parseInt(p, 10));
  let h = 0, min = 0;
  if (timePart) {
    [h, min] = timePart.split(":").map((p) => parseInt(p, 10));
  }
  const date = new Date(Date.UTC(y, m - 1, d, h || 0, min || 0));
  return isNaN(date.getTime()) ? null : date;
}

export function parseResult(s) {
  // formato "2 - 0" cuando ya se jugó, "-" si no
  if (!s) return null;
  const match = s.trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) return null;
  return { home: parseInt(match[1], 10), away: parseInt(match[2], 10) };
}
