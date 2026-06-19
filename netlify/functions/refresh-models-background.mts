import { getStore } from "@netlify/blobs";
import { LEAGUES, seasonCodes, csvUrl } from "./config.mjs";
import { parseCsv, parseDateUK } from "./csv.mjs";
import { fitModel } from "./model.mjs";

async function fetchLeagueMatches(leagueCode) {
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

export default async (req, context) => {
  const store = getStore("football-models");
  const summary = {};

  for (const leagueCode of Object.keys(LEAGUES)) {
    const matches = await fetchLeagueMatches(leagueCode);
    if (matches.length < 20) {
      console.error(`Muy pocos partidos para ${leagueCode} (${matches.length}), se omite`);
      continue;
    }
    const model = fitModel(matches);
    await store.setJSON(`model:${leagueCode}`, model);
    summary[leagueCode] = { teams: model.teams.length, matches: matches.length };
    console.log(`${leagueCode}: ${model.teams.length} equipos, ${matches.length} partidos`);
  }

  await store.setJSON("last-refresh", { at: new Date().toISOString(), summary });
  console.log("Actualización completa:", summary);
};
