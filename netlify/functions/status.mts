import { getStore } from "@netlify/blobs";
import { LEAGUES } from "./config.mjs";

export default async (req) => {
  const store = getStore("football-models");
  const lastRefresh = await store.get("last-refresh", { type: "json" });
  const leagues = Object.fromEntries(
    Object.entries(LEAGUES).map(([code, info]) => [code, info.name])
  );
  return Response.json({ leagues, lastRefresh: lastRefresh || null });
};

export const config = {
  path: "/api/status",
};
