import { getStore } from "@netlify/blobs";
import { LEAGUES, clubSeasonYear } from "./config.mjs";
import { fetchLeagueFixtures } from "./apiFootball.mjs";
import { fitModel } from "./model.mjs";

export default async (req, context) => {
  const store = getStore("football-models");
  const summary = {};
  const season = clubSeasonYear();

  for (const [code, info] of Object.entries(LEAGUES)) {
    const seasonToUse = info.season || season;
    try {
      const { matches, fixtures } = await fetchLeagueFixtures(info.apiId, seasonToUse);
      console.log(`${code}: ${matches.length} jugados, ${fixtures.length} en calendario`);

      await store.setJSON(`fixtures:${code}`, fixtures);

      const minMatches = info.type === "international" ? 10 : 20;
      if (matches.length >= minMatches) {
        const modelOptions =
          info.type === "international" ? { xi: 0.0006, l2reg: 0.01 } : {};
        const model = fitModel(matches, modelOptions);
        await store.setJSON(`model:${code}`, model);
        summary[code] = { teams: model.teams.length, matches: matches.length };
      } else {
        console.error(`${code}: muy pocos partidos jugados (${matches.length}) para entrenar todavía`);
      }
    } catch (e) {
      console.error(`Fallo procesando ${code}:`, e.message);
    }
  }

  await store.setJSON("last-refresh", { at: new Date().toISOString(), summary });
  console.log("Actualización completa:", summary);
};
