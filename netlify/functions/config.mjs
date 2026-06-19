export const LEAGUES = {
  E0: "Premier League (Inglaterra)",
  SP1: "La Liga (España)",
  I1: "Serie A (Italia)",
  D1: "Bundesliga (Alemania)",
  F1: "Ligue 1 (Francia)",
};

export const N_SEASONS = 4;
const BASE_URL = "https://www.football-data.co.uk/mmz4281";

export function seasonCodes(nSeasons = N_SEASONS, endYear = null) {
  const today = new Date();
  if (endYear === null) {
    endYear = today.getUTCMonth() + 1 >= 7 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
  }
  const codes = [];
  for (let i = 0; i < nSeasons; i++) {
    const start = endYear - i;
    const end = start + 1;
    codes.push(`${String(start).slice(-2)}${String(end).slice(-2)}`);
  }
  return codes;
}

export function csvUrl(leagueCode, seasonCode) {
  return `${BASE_URL}/${seasonCode}/${leagueCode}.csv`;
}

export const FIXTURES_URL = "https://www.football-data.co.uk/fixtures.csv";
