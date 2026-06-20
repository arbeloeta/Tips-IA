import { LEAGUES, clubSeasonYear } from "./config.mjs";
import { fetchLeagueFixtures } from "./apiFootball.mjs";

export default async (req) => {
  const url = new URL(req.url);
  const competition = url.searchParams.get("competition");
  const info = LEAGUES[competition];

  if (!info) {
    return Response.json({ error: "Competición no válida" }, { status: 400 });
  }

  try {
    const season = info.season || clubSeasonYear();
    const { fixtures } = await fetchLeagueFixtures(info.apiId, season);
    return Response.json({ fixtures, modelReady: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
};

export const config = {
  path: "/api/fixtures",
};
