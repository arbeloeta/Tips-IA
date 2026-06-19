import { getStore } from "@netlify/blobs";
import { LEAGUES } from "./config.mjs";
import { scoreMatrix } from "./model.mjs";
import { allMarkets } from "./markets.mjs";

export default async (req) => {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo de petición inválido" }, { status: 400 });
  }

  const { league, home, away } = body;
  if (!league || !home || !away) {
    return Response.json({ error: "Faltan datos (liga, local o visitante)" }, { status: 400 });
  }
  if (!LEAGUES[league]) {
    return Response.json({ error: "Liga no válida" }, { status: 400 });
  }
  if (home === away) {
    return Response.json({ error: "El local y el visitante no pueden ser el mismo equipo" }, { status: 400 });
  }

  const store = getStore("football-models");
  const model = await store.get(`model:${league}`, { type: "json" });
  if (!model) {
    return Response.json({ error: "El modelo de esta liga todavía no está listo. Inténtalo en unos minutos." }, { status: 503 });
  }

  try {
    const { matrix, lam, mu } = scoreMatrix(model, home, away);
    const markets = allMarkets(matrix);
    return Response.json({
      partido: `${home} vs ${away}`,
      goles_esperados: { local: Math.round(lam * 100) / 100, visitante: Math.round(mu * 100) / 100 },
      mercados: markets,
      modelo_entrenado: model.trainedAt,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
};

export const config = {
  path: "/api/predict",
};
