import { LEAGUES, clubSeasonYear } from "./config.mjs";
import { fetchLeagueFixtures } from "./apiFootball.mjs";
import { fitModel, scoreMatrix } from "./model.mjs";
import { allMarkets } from "./markets.mjs";

export default async (req) => {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo de petición inválido" }, { status: 400 });
  }

  const { league, home, away } = body;
  const info = LEAGUES[league];

  if (!info) {
    return Response.json({ error: "Competición no válida" }, { status: 400 });
  }
  if (!home || !away) {
    return Response.json({ error: "Faltan datos (local o visitante)" }, { status: 400 });
  }
  if (home === away) {
    return Response.json({ error: "El local y el visitante no pueden ser el mismo equipo" }, { status: 400 });
  }

  try {
    const season = info.season || clubSeasonYear();
    const { matches } = await fetchLeagueFixtures(info.apiId, season);

    const minMatches = info.type === "international" ? 6 : 20;
    if (matches.length < minMatches) {
      return Response.json(
        { error: "Todavía no hay suficientes partidos jugados en esta competición para predecir." },
        { status: 503 }
      );
    }

    const modelOptions = info.type === "international" ? { xi: 0.0006, l2reg: 0.01 } : {};
    const model = fitModel(matches, modelOptions);

    const { matrix, lam, mu } = scoreMatrix(model, home, away);
    const markets = allMarkets(matrix);

    return Response.json({
      partido: `${home} vs ${away}`,
      goles_esperados: { local: Math.round(lam * 100) / 100, visitante: Math.round(mu * 100) / 100 },
      mercados: markets,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
};

export const config = {
  path: "/api/predict",
};
