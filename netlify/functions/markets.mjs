export function market1x2(matrix) {
  const n = matrix.length;
  let home = 0, draw = 0, away = 0;
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      if (x > y) home += matrix[x][y];
      else if (x === y) draw += matrix[x][y];
      else away += matrix[x][y];
    }
  }
  return { "1 (Local)": home, "X (Empate)": draw, "2 (Visitante)": away };
}

export function marketExactScore(matrix, topN = 10) {
  const n = matrix.length;
  const scores = [];
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      scores.push({ marcador: `${x}-${y}`, prob: matrix[x][y] });
    }
  }
  scores.sort((a, b) => b.prob - a.prob);
  return scores.slice(0, topN);
}

export function marketOverUnder(matrix, lines = [0.5, 1.5, 2.5, 3.5, 4.5]) {
  const n = matrix.length;
  const totalGoalsProbs = new Array(2 * n - 1).fill(0);
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      totalGoalsProbs[x + y] += matrix[x][y];
    }
  }
  const result = {};
  for (const line of lines) {
    let over = 0;
    totalGoalsProbs.forEach((p, goals) => {
      if (goals > line) over += p;
    });
    result[`Over/Under ${line}`] = { Over: over, Under: 1 - over };
  }
  return result;
}

export function marketBtts(matrix) {
  const n = matrix.length;
  let yes = 0;
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      if (x > 0 && y > 0) yes += matrix[x][y];
    }
  }
  return { "BTTS Sí": yes, "BTTS No": 1 - yes };
}

export function marketAsianHandicap(matrix, lines = [-1.0, -0.5, 0.0, 0.5, 1.0]) {
  const n = matrix.length;
  const result = {};
  for (const line of lines) {
    let homeCover = 0, awayCover = 0, push = 0;
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        const diff = x + line - y;
        const p = matrix[x][y];
        if (diff > 0) homeCover += p;
        else if (diff < 0) awayCover += p;
        else push += p;
      }
    }
    result[`Hándicap Local ${line >= 0 ? "+" : ""}${line.toFixed(1)}`] = {
      "Local cubre": homeCover,
      "Visitante cubre": awayCover,
      "Push (devolución)": push,
    };
  }
  return result;
}

export function allMarkets(matrix) {
  return {
    "1X2": market1x2(matrix),
    "Marcador exacto (top 10)": marketExactScore(matrix),
    "Goles totales": marketOverUnder(matrix),
    "Ambos marcan": marketBtts(matrix),
    "Hándicap asiático": marketAsianHandicap(matrix),
  };
}
