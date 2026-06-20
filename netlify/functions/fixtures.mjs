import { LEAGUES } from "./config.mjs";
import { fetchClubLeagueData, fetchWC26Data } from "./liveSources.mjs";

export default async (req) => {
  const url = new URL(req.url);
  const competition = url.searchParams.get("competition");
  const info = LEAGUES[competition];

  if (!info) {
    return Response.json({ error: "Competición no válida" }, { status: 400 });
  }

  try {
    const { fixtures } =
      info.type === "international"
        ? await fetchWC26Data()
        : await fetchClubLeagueData(competition);
    return Response.json({ fixtures });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
};

export const config = {
  path: "/api/fixtures",
};
