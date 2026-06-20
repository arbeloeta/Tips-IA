import { getStore } from "@netlify/blobs";
import { LEAGUES } from "./config.mjs";

export default async (req) => {
  const url = new URL(req.url);
  const competition = url.searchParams.get("competition");

  if (!competition || !LEAGUES[competition]) {
    return Response.json({ error: "Competición no válida" }, { status: 400 });
  }

  const store = getStore("football-models");
  const fixtures = await store.get(`fixtures:${competition}`, { type: "json" });
  const model = await store.get(`model:${competition}`, { type: "json" });

  return Response.json({
    fixtures: fixtures || [],
    modelReady: !!model,
  });
};

export const config = {
  path: "/api/fixtures",
};
