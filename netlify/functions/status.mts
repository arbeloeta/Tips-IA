import { getStore } from "@netlify/blobs";
import { LEAGUES } from "./config.mjs";

export default async (req) => {
  const store = getStore("football-models");
  const lastRefresh = await store.get("last-refresh", { type: "json" });
  return Response.json({ leagues: LEAGUES, lastRefresh: lastRefresh || null });
};

export const config = {
  path: "/api/status",
};
