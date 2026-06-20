import { API_FOOTBALL_BASE } from "./config.mjs";

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

export async function fetchLeagueFixtures(apiId, season) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    throw new Error("Falta la variable de entorno API_FOOTBALL_KEY en Netlify");
  }

  const url = `${API_FOOTBALL_BASE}/fixtures?league=${apiId}&season=${season}`;
  const resp = await fetch(url, {
    headers: { "x-apisports-key": apiKey },
  });

  if (!resp.ok) {
    throw new Error(`API-Football respondió HTTP ${resp.status} para league=${apiId} season=${season}`);
  }

  const data = await resp.json();
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(data.errors)}`);
  }

  const matches = []; // ya jugados, para entrenar el modelo
  const fixtures = []; // todos, para la lista de partidos en la web

  for (const item of data.response || []) {
    const status = item.fixture?.status?.short;
    const date = item.fixture?.date;
    const home = item.teams?.home?.name;
    const away = item.teams?.away?.name;
    const goalsHome = item.goals?.home;
    const goalsAway = item.goals?.away;
    const played = FINISHED_STATUSES.has(status);

    if (!date || !home || !away) continue;

    fixtures.push({
      date,
      home,
      away,
      group: item.league?.round || "",
      played,
      score: played && goalsHome !== null && goalsAway !== null ? `${goalsHome}-${goalsAway}` : null,
    });

    if (played && goalsHome !== null && goalsAway !== null) {
      matches.push({ home, away, fthg: goalsHome, ftag: goalsAway, date: new Date(date) });
    }
  }

  return { matches, fixtures };
}
