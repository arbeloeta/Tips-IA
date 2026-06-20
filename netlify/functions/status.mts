import { LEAGUES } from "./config.mjs";

export default async (req) => {
  const leagues = Object.fromEntries(
    Object.entries(LEAGUES).map(([code, info]) => [code, info.name])
  );
  return Response.json({ leagues });
};

export const config = {
  path: "/api/status",
};
