/**
 * Modelo de goles esperados estilo Dixon-Coles, sin dependencias externas.
 * Ajusta attack[i], defense[i] por equipo y un home_advantage global mediante
 * descenso de gradiente (Adam) sobre la log-verosimilitud de Poisson, con
 * decaimiento temporal y regularización L2. Aplica una corrección fija para
 * marcadores bajos (rho) al construir la matriz final de probabilidades.
 */

const RHO = -0.08; // corrección estándar para marcadores bajos (Dixon-Coles 1997)
const MAX_GOALS = 8;

function poissonPmf(k, lambda) {
  // log para estabilidad, luego exponenciamos
  let logP = -lambda + k * Math.log(lambda) - logFactorial(k);
  return Math.exp(logP);
}

const _logFactCache = [0, 0];
function logFactorial(n) {
  for (let i = _logFactCache.length; i <= n; i++) {
    _logFactCache.push(_logFactCache[i - 1] + Math.log(i));
  }
  return _logFactCache[n];
}

function tau(x, y, lam, mu, rho) {
  if (x === 0 && y === 0) return 1 - lam * mu * rho;
  if (x === 0 && y === 1) return 1 + lam * rho;
  if (x === 1 && y === 0) return 1 + mu * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

export function fitModel(matches, { xi = 0.0022, l2reg = 0.0015, iters = 400, lr = 0.05 } = {}) {
  const teams = Array.from(new Set(matches.flatMap((m) => [m.home, m.away]))).sort();
  const n = teams.length;
  const idx = new Map(teams.map((t, i) => [t, i]));

  const refDate = matches.reduce((max, m) => (m.date > max ? m.date : max), matches[0].date);
  const homeIdx = matches.map((m) => idx.get(m.home));
  const awayIdx = matches.map((m) => idx.get(m.away));
  const fthg = matches.map((m) => m.fthg);
  const ftag = matches.map((m) => m.ftag);
  const weights = matches.map((m) => {
    const daysAgo = Math.max(0, (refDate - m.date) / 86400000);
    return Math.exp(-xi * daysAgo);
  });

  let attack = new Array(n).fill(0);
  let defense = new Array(n).fill(0);
  let homeAdv = 0.2;

  // Adam optimizer state
  const mAttack = new Array(n).fill(0), vAttack = new Array(n).fill(0);
  const mDefense = new Array(n).fill(0), vDefense = new Array(n).fill(0);
  let mHome = 0, vHome = 0;
  const beta1 = 0.9, beta2 = 0.999, eps = 1e-8;

  const M = matches.length;

  for (let t = 1; t <= iters; t++) {
    const gAttack = new Array(n).fill(0);
    const gDefense = new Array(n).fill(0);
    let gHome = 0;

    for (let k = 0; k < M; k++) {
      const hi = homeIdx[k], ai = awayIdx[k];
      const lam = Math.exp(attack[hi] + defense[ai] + homeAdv);
      const mu = Math.exp(attack[ai] + defense[hi]);
      const w = weights[k];

      const dHome = w * (lam - fthg[k]);
      const dAway = w * (mu - ftag[k]);

      gAttack[hi] += dHome;
      gDefense[ai] += dHome;
      gHome += dHome;

      gAttack[ai] += dAway;
      gDefense[hi] += dAway;
    }

    for (let i = 0; i < n; i++) {
      gAttack[i] += 2 * l2reg * attack[i];
      gDefense[i] += 2 * l2reg * defense[i];
    }

    // Adam updates
    for (let i = 0; i < n; i++) {
      mAttack[i] = beta1 * mAttack[i] + (1 - beta1) * gAttack[i];
      vAttack[i] = beta2 * vAttack[i] + (1 - beta2) * gAttack[i] ** 2;
      const mHat = mAttack[i] / (1 - beta1 ** t);
      const vHat = vAttack[i] / (1 - beta2 ** t);
      attack[i] -= lr * mHat / (Math.sqrt(vHat) + eps);

      mDefense[i] = beta1 * mDefense[i] + (1 - beta1) * gDefense[i];
      vDefense[i] = beta2 * vDefense[i] + (1 - beta2) * gDefense[i] ** 2;
      const mHatD = mDefense[i] / (1 - beta1 ** t);
      const vHatD = vDefense[i] / (1 - beta2 ** t);
      defense[i] -= lr * mHatD / (Math.sqrt(vHatD) + eps);
    }
    mHome = beta1 * mHome + (1 - beta1) * gHome;
    vHome = beta2 * vHome + (1 - beta2) * gHome ** 2;
    const mHatH = mHome / (1 - beta1 ** t);
    const vHatH = vHome / (1 - beta2 ** t);
    homeAdv -= lr * mHatH / (Math.sqrt(vHatH) + eps);
  }

  // normalizar: ataque medio = 0 (solo por interpretabilidad, no cambia las predicciones)
  const meanAttack = attack.reduce((a, b) => a + b, 0) / n;
  attack = attack.map((a) => a - meanAttack);
  defense = defense.map((d) => d + meanAttack);

  const ratings = {};
  teams.forEach((t, i) => {
    ratings[t] = { attack: attack[i], defense: defense[i] };
  });

  return { teams, ratings, homeAdv, rho: RHO, trainedAt: new Date().toISOString(), nMatches: M };
}

export function expectedGoals(model, home, away) {
  const rh = model.ratings[home];
  const ra = model.ratings[away];
  if (!rh || !ra) throw new Error(`Equipo no reconocido: ${!rh ? home : away}`);
  const lam = dampen(Math.exp(rh.attack + ra.defense + model.homeAdv));
  const mu = dampen(Math.exp(ra.attack + rh.defense));
  return { lam, mu };
}

// En fútbol real casi nunca se ven goles esperados por encima de ~4-4.5,
// incluso en los desniveles más grandes (factores como bajar el ritmo con
// ventaja amplia no los captura un Poisson puro). Comprimimos suavemente
// los valores extremos en vez de cortarlos en seco.
function dampen(x, cap = 4.2, softness = 0.55) {
  if (x <= cap) return x;
  return cap + (x - cap) / (1 + (x - cap) * softness);
}

export function scoreMatrix(model, home, away, maxGoals = MAX_GOALS) {
  const { lam, mu } = expectedGoals(model, home, away);
  const rho = model.rho;
  const matrix = [];
  let total = 0;
  for (let x = 0; x <= maxGoals; x++) {
    const row = [];
    for (let y = 0; y <= maxGoals; y++) {
      const p = Math.max(0, poissonPmf(x, lam) * poissonPmf(y, mu) * tau(x, y, lam, mu, rho));
      row.push(p);
      total += p;
    }
    matrix.push(row);
  }
  for (let x = 0; x <= maxGoals; x++) {
    for (let y = 0; y <= maxGoals; y++) {
      matrix[x][y] /= total;
    }
  }
  return { matrix, lam, mu };
}
