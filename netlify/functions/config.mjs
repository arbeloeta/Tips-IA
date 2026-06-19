export const LEAGUES = {
  E0: { name: "Premier League (Inglaterra)", type: "club" },
  SP1: { name: "La Liga (España)", type: "club" },
  I1: { name: "Serie A (Italia)", type: "club" },
  D1: { name: "Bundesliga (Alemania)", type: "club" },
  F1: { name: "Ligue 1 (Francia)", type: "club" },
  WC26: { name: "Mundial 2026", type: "international" },
};

export const N_SEASONS = 4;
const BASE_URL = "https://www.football-data.co.uk/mmz4281";
export const FIXTURES_URL = "https://www.football-data.co.uk/fixtures.csv";
export const WC26_URL = "https://fixturedownload.com/download/csv/fifa-world-cup-2026";

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
