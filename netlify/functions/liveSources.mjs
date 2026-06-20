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
    }));

  let upcoming = [];
  const fixturesResp = await fetch(FIXTURES_URL, { headers: BROWSER_HEADERS });
  if (fixturesResp.ok) {
    const text = await fixturesResp.text();
    const rows = parseCsv(text);
    upcoming = rows
      .filter((r) => r.Div === leagueCode)
      .map((r) => ({
        date: parseDateUK(r.Date)?.toISOString() || null,
        home: r.HomeTeam,
        away: r.AwayTeam,
        played: false,
        score: null,
      }))
      .filter((f) => f.date && f.home && f.away);
  } else {
    console.error(`${FIXTURES_URL} respondió HTTP ${fixturesResp.status}`);
  }

  return { matches, fixtures: [...recentPlayed, ...upcoming] };
}

export async function fetchWC26Data() {
  const resp = await fetch(WC26_URL, { headers: BROWSER_HEADERS });
  if (!resp.ok) {
    throw new Error(`${WC26_URL} respondió HTTP ${resp.status}`);
  }
  const text = await resp.text();
  const rows = parseCsv(text);

  const matches = [];
  const fixtures = [];

  for (const row of rows) {
    const date = parseDateTimeEU(row.Date);
    const home = row["Home Team"];
    const away = row["Away Team"];
    const result = parseResult(row.Result);
    const group = row.Group || row["Round Number"] || "";

    if (!date || !home || !away) continue;

    fixtures.push({
      date: date.toISOString(),
      home,
      away,
      group,
      played: !!result,
      score: result ? `${result.home}-${result.away}` : null,
    });

    if (result && !isPlaceholderTeam(home) && !isPlaceholderTeam(away)) {
      matches.push({ home, away, fthg: result.home, ftag: result.away, date });
    }
  }

  return { matches, fixtures };
}
