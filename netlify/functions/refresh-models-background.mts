import { getStore } from "@netlify/blobs";
import { LEAGUES, seasonCodes, csvUrl, FIXTURES_URL, WC26_URL } from "./config.mjs";
import { parseCsv, parseDateUK, parseDateTimeEU, parseResult } from "./csv.mjs";
import { fitModel } from "./model.mjs";

async function fetchClubLeagueMatches(leagueCode) {
  const seasons = seasonCodes();
  const allMatches = [];
  for (const season of seasons) {
    const url = csvUrl(leagueCode, season);
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const text = await resp.text();
      const rows = parseCsv(text);
      for (const row of rows) {
        const date = parseDateUK(row.Date);
        const fthg = parseInt(row.FTHG, 10);
        const ftag = parseInt(row.FTAG, 10);
        if (!date || !row.HomeTeam || !row.AwayTeam || isNaN(fthg) || isNaN(ftag)) continue;
        allMatches.push({ home: row.HomeTeam, away: row.AwayTeam, fthg, ftag, date });
      }
    } catch (e) {
      console.error(`Error descargando ${url}:`, e.message);
    }
  }
  return allMatches;
}

async function fetchAllClubFixtures() {
  // un solo fichero con los próximos partidos de TODAS las ligas
  try {
    const resp = await fetch(FIXTURES_URL);
    if (!resp.ok) return [];
    const text = await resp.text();
    return parseCsv(text);
  } catch (e) {
    console.error("Error descargando fixtures.csv:", e.message);
    return [];
  }
}

async function fetchWC26() {
  try {
    const resp = await fetch(WC26_URL);
    if (!resp.ok) return { matches: [], fixtures: [] };
    const text = await resp.text();
    const rows = parseCsv(text);

    const matches = []; // ya jugados, para entrenar el modelo
    const fixtures = []; // todos, para la lista de partidos en la web

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
        round: row["Round Number"],
        location: row.Location,
        played: !!result,
        score: result ? `${result.home}-${result.away}` : null,
      });

      // los cruces de eliminatoria con placeholders ("2A", "1C", "To be announced")
      // no sirven para entrenar el modelo, solo partidos de fase de grupos ya jugados
      if (result && !/^[123]?[A-Z]{1,6}$/.test(home) && home !== "To be announced") {
        matches.push({ home, away, fthg: result.home, ftag: result.away, date });
      }
    }
    return { matches, fixtures };
  } catch (e) {
    console.error("Error descargando datos del Mundial:", e.message);
    return { matches: [], fixtures: [] };
  }
}

export default async (req, context) => {
  const store = getStore("football-models");
  const summary = {};

  const clubCodes = Object.keys(LEAGUES).filter((c) => LEAGUES[c].type === "club");
  const allFixtureRows = await fetchAllClubFixtures();

  for (const leagueCode of clubCodes) {
    const matches = await fetchClubLeagueMatches(leagueCode);
    if (matches.length >= 20) {
      const model = fitModel(matches);
      await store.setJSON(`model:${leagueCode}`, model);
      summary[leagueCode] = { teams: model.teams.length, matches: matches.length };
    } else {
      console.error(`Muy pocos partidos para ${leagueCode} (${matches.length}), se omite`);
    }

    const upcoming = allFixtureRows
      .filter((r) => r.Div === leagueCode)
      .map((r) => ({
        date: parseDateUK(r.Date)?.toISOString() || null,
        home: r.HomeTeam,
        away: r.AwayTeam,
        played: false,
        score: null,
      }))
      .filter((f) => f.date && f.home && f.away);
    await store.setJSON(`fixtures:${leagueCode}`, upcoming);
  }

  // Mundial 2026
  const wc = await fetchWC26();
  if (wc.matches.length >= 10) {
    const wcModel = fitModel(wc.matches, { xi: 0.0006, l2reg: 0.01 });
    await store.setJSON("model:WC26", wcModel);
    summary.WC26 = { teams: wcModel.teams.length, matches: wc.matches.length };
  } else {
    console.error(`Muy pocos partidos jugados del Mundial (${wc.matches.length}) para entrenar todavía`);
  }
  await store.setJSON("fixtures:WC26", wc.fixtures);

  await store.setJSON("last-refresh", { at: new Date().toISOString(), summary });
  console.log("Actualización completa:", summary);
};
