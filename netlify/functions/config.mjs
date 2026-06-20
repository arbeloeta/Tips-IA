export const LEAGUES = {
  E0: { name: "Premier League (Inglaterra)", type: "club", apiId: 39 },
  SP1: { name: "La Liga (España)", type: "club", apiId: 140 },
  I1: { name: "Serie A (Italia)", type: "club", apiId: 135 },
  D1: { name: "Bundesliga (Alemania)", type: "club", apiId: 78 },
  F1: { name: "Ligue 1 (Francia)", type: "club", apiId: 61 },
  WC26: { name: "Mundial 2026", type: "international", apiId: 1, season: 2026 },
};

export const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

export function clubSeasonYear() {
  const today = new Date();
  // las ligas europeas empiezan en verano: si estamos antes de julio, la
  // temporada en curso empezó el año anterior
  return today.getUTCMonth() + 1 >= 7 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
}
