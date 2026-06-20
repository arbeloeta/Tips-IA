import { seasonCodes, csvUrl, FIXTURES_URL, WC26_URL, BROWSER_HEADERS } from "./config.mjs";
import { parseCsv, parseDateUK, parseDateTimeEU, parseResult } from "./csv.mjs";

function isPlaceholderTeam(name) {
  if (!name) return true;
  const n = name.trim();
  if (/^\d[A-Za-z]{1,2}$/.test(n)) return true; // "2A", "1C", etc.
  const lower = n.toLowerCase();
  return lower === "tbd" || lower.includes("winner") || lower.includes("runner") || lower === "to be announced";
}

export async function fetchClubLeagueData(leagueCode) {
  const seasons = seasonCodes();
  const matches = [];

  for (const season of seasons) {
    const url = csvUrl(leagueCode, season);
    const resp = await fetch(url, { headers: BROWSER_HEADERS });
    if (!resp.ok) {
      throw new Error(`${url} respondió HTTP ${resp.status}`);
    }
    const text = await resp.text();
    const rows = parseCsv(text);
    for (const row of rows) {
      const date = parseDateUK(row.Date);
      const fthg = parseInt(row.FTHG, 10);
      const ftag = parseInt(row.FTAG, 10);
      if (!date || !row.HomeTeam || !row.AwayTeam || isNaN(fthg) || isNaN(ftag)) continue;
      matches.push({ home: row.HomeTeam, away: row.AwayTeam, fthg, ftag, date });
    }
  }

  // los últimos partidos jugados, para que siempre haya algo que mostrar
  // aunque estemos fuera de temporada y no haya próximos partidos todavía
  const recentPlayed = [...matches]
    .sort((a, b) => a.date - b.date)
    .slice(-15)
    .map((m) => ({
      date: m.date.toISOString(),
      home: m.home,
      away: m.away,
      played: true,
      score: `${m.fthg}-${m.ftag}`,
      hideTime: true, // el CSV histórico no trae hora real
    }));

  let upcoming = [];
  const fixturesResp = await fetch(FIXTURES_URL, { headers: BROWSER_HEADERS });
  if (fixturesResp.ok) {
    const text = await fixturesResp.text();
    const rows = parseCsv(text);
    upcoming = rows
      .filter((r) => r.Div === leagueCode)
      .map((r) => {
        const date = parseDateUK(r.Date);
        if (date && r.Time) {
          const [h, min] = r.Time.split(":").map((p) => parseInt(p, 10));
          if (!isNaN(h) && !isNaN(min)) date.setUTCHours(h, min);
        }
        return {
          date: date?.toISOString() || null,
          home: r.HomeTeam,
          away: r.AwayTeam,
          played: false,
          score: null,
          hideTime: !r.Time,
        };
      })
      .filter((f) => f.date && f.home && f.away);
  } else {
    console.error(`${FIXTURES_URL} respondió HTTP ${fixturesResp.status}`);
  }

  return { matches, fixtures: [...recentPlayed, ...upcoming] };
}

function parseWCDateTime(dateStr, timeStr) {
  // dateStr: "2026-06-11", timeStr: "13:00 UTC-6" (o "19:00" sin offset)
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map((p) => parseInt(p, 10));
  let hour = 0, minute = 0, offset = 0;
  if (timeStr) {
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s+UTC([+-]\d+))?$/);
    if (match) {
      hour = parseInt(match[1], 10);
      minute = parseInt(match[2], 10);
      offset = match[3] ? parseInt(match[3], 10) : 0;
    }
  }
  // hora local "UTC-6" significa que la hora UTC real es hora_local - offset
  const utcHour = hour - offset;
  const date = new Date(Date.UTC(y, m - 1, d, utcHour, minute));
  return isNaN(date.getTime()) ? null : date;
}

export async function fetchWC26Data() {
  const resp = await fetch(WC26_URL, { headers: BROWSER_HEADERS });
  if (!resp.ok) {
    throw new Error(`${WC26_URL} respondió HTTP ${resp.status}`);
  }
  const data = await resp.json();

  const matches = [];
  const fixtures = [];

  for (const item of data.matches || []) {
    const date = parseWCDateTime(item.date, item.time);
    const home = item.team1;
    const away = item.team2;
    const ft = item.score?.ft;
    const played = Array.isArray(ft);

    if (!date || !home || !away) continue;

    fixtures.push({
      date: date.toISOString(),
      home,
      away,
      group: item.group || item.round || "",
      played,
      score: played ? `${ft[0]}-${ft[1]}` : null,
      hideTime: false,
    });

    if (played && !isPlaceholderTeam(home) && !isPlaceholderTeam(away)) {
      matches.push({ home, away, fthg: ft[0], ftag: ft[1], date });
    }
  }

  return { matches, fixtures };
}
