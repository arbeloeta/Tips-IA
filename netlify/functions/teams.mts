import { getStore } from "@netlify/blobs";
import { LEAGUES } from "./config.mjs";

export default async (req) => {
  const url = new URL(req.url);
  const league = url.searchParams.get("league");

  if (!league || !LEAGUES[league]) {
    return Response.json({ error: "Liga no válida" }, { status: 400 });
  }

  const store = getStore("football-models");
  const model = await store.get(`model:${league}`, { type: "json" });

  if (!model) {
    return Response.json({ teams: [], ready: false });
  }

  return Response.json({ teams: model.teams, ready: true, trainedAt: model.trainedAt });
};

export const config = {
  path: "/api/teams",
};
