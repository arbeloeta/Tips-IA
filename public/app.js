const leagueSelect = document.getElementById('league-select');
const homeSelect = document.getElementById('home-select');
const awaySelect = document.getElementById('away-select');
const predictBtn = document.getElementById('predict-btn');
const updateBtn = document.getElementById('update-btn');
const updateLabel = document.getElementById('update-label');
const statusMsg = document.getElementById('status-msg');
const results = document.getElementById('results');
const refreshInfo = document.getElementById('refresh-info');

function setStatus(msg, isError = false) {
  statusMsg.textContent = msg || '';
  statusMsg.classList.toggle('error', isError);
}

function fillSelect(select, options, placeholder) {
  select.innerHTML = '';
  if (placeholder) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    select.appendChild(opt);
  }
  options.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
}

async function loadLeagues() {
  const res = await fetch('/api/status');
  const data = await res.json();
  fillSelect(leagueSelect, Object.entries(data.leagues).map(([code, name]) => name));
  // guardamos el mapeo nombre->código en el propio <option>
  Array.from(leagueSelect.options).forEach((opt, i) => {
    opt.value = Object.keys(data.leagues)[i];
  });

  if (data.lastRefresh) {
    const d = new Date(data.lastRefresh.at);
    refreshInfo.textContent = `Datos actualizados: ${d.toLocaleString('es-ES')}`;
  } else {
    refreshInfo.textContent = 'Modelo Dixon–Coles · sin datos todavía';
  }

  await loadTeams();
}

async function loadTeams() {
  setStatus('Cargando equipos...');
  fillSelect(homeSelect, [], 'Cargando...');
  fillSelect(awaySelect, [], 'Cargando...');

  const league = leagueSelect.value;
  if (!league) return;

  const res = await fetch(`/api/teams?league=${league}`);
  const data = await res.json();

  if (!data.ready || !data.teams || data.teams.length === 0) {
    fillSelect(homeSelect, [], 'Sin datos todavía');
    fillSelect(awaySelect, [], 'Sin datos todavía');
    setStatus('Esta liga aún no tiene modelo entrenado. Pulsa "Actualizar ahora" arriba y espera unos minutos.', true);
    return;
  }

  fillSelect(homeSelect, data.teams, 'Elige equipo local');
  fillSelect(awaySelect, data.teams, 'Elige equipo visitante');
  setStatus('');
}

async function triggerUpdate() {
  updateBtn.disabled = true;
  updateLabel.textContent = 'Actualizando en segundo plano...';
  setStatus('Se ha lanzado la actualización. Puede tardar 1-2 minutos en terminar; vuelve a intentarlo en breve.');
  try {
    await fetch('/.netlify/functions/refresh-models-background', { method: 'POST' });
  } catch (e) {
    setStatus('No se pudo lanzar la actualización.', true);
  } finally {
    updateBtn.disabled = false;
    updateLabel.textContent = 'Actualizar ahora';
  }
}

function renderBars(container, dict) {
  container.innerHTML = '';
  Object.entries(dict).forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'bar-row';
    const pct = (value * 100).toFixed(1);
    row.innerHTML = `
      <span class="bar-label">${label}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
      <span class="bar-value">${pct}%</span>
    `;
    container.appendChild(row);
  });
}

function renderOverUnder(table, ouData) {
  let html = '<tr><th>Línea</th><th class="num">Over</th><th class="num">Under</th></tr>';
  Object.entries(ouData).forEach(([line, probs]) => {
    const lineLabel = line.replace('Over/Under ', '');
    html += `<tr>
      <td>${lineLabel}</td>
      <td class="num">${(probs.Over * 100).toFixed(1)}%</td>
      <td class="num">${(probs.Under * 100).toFixed(1)}%</td>
    </tr>`;
  });
  table.innerHTML = html;
}

function renderHandicap(table, ahData) {
  let html = '<tr><th>Línea</th><th class="num">Local</th><th class="num">Visit.</th></tr>';
  Object.entries(ahData).forEach(([line, probs]) => {
    const lineLabel = line.replace('Hándicap Local ', '');
    html += `<tr>
      <td>${lineLabel}</td>
      <td class="num">${(probs['Local cubre'] * 100).toFixed(1)}%</td>
      <td class="num">${(probs['Visitante cubre'] * 100).toFixed(1)}%</td>
    </tr>`;
  });
  table.innerHTML = html;
}

function renderExactScores(list, scores) {
  list.innerHTML = '';
  scores.slice(0, 6).forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="rank">${i + 1}</span>
      <span class="score">${s.marcador}</span>
      <span class="prob">${(s.prob * 100).toFixed(1)}%</span>
    `;
    list.appendChild(li);
  });
}

async function predict() {
  const league = leagueSelect.value;
  const home = homeSelect.value;
  const away = awaySelect.value;

  if (!home || !away) {
    setStatus('Elige equipo local y visitante.', true);
    return;
  }
  if (home === away) {
    setStatus('El local y el visitante no pueden ser el mismo equipo.', true);
    return;
  }

  predictBtn.disabled = true;
  predictBtn.textContent = 'Calculando...';
  setStatus('');

  try {
    const res = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ league, home, away }),
    });
    const data = await res.json();

    if (data.error) {
      setStatus(data.error, true);
      results.classList.add('hidden');
      return;
    }

    document.getElementById('xg-home').textContent = data.goles_esperados.local.toFixed(2);
    document.getElementById('xg-away').textContent = data.goles_esperados.visitante.toFixed(2);
    document.getElementById('xg-home-tag').textContent = home;
    document.getElementById('xg-away-tag').textContent = away;

    const topScore = data.mercados['Marcador exacto (top 10)'][0].marcador.split('-');
    document.getElementById('score-home').textContent = topScore[0];
    document.getElementById('score-away').textContent = topScore[1];

    renderBars(document.getElementById('bars-1x2'), data.mercados['1X2']);
    renderBars(document.getElementById('btts-bars'), data.mercados['Ambos marcan']);
    renderOverUnder(document.getElementById('ou-table'), data.mercados['Goles totales']);
    renderHandicap(document.getElementById('ah-table'), data.mercados['Hándicap asiático']);
    renderExactScores(document.getElementById('exact-scores'), data.mercados['Marcador exacto (top 10)']);

    results.classList.remove('hidden');
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    setStatus('Error de conexión al pedir la predicción.', true);
  } finally {
    predictBtn.disabled = false;
    predictBtn.textContent = 'Generar predicción';
  }
}

leagueSelect.addEventListener('change', loadTeams);
updateBtn.addEventListener('click', triggerUpdate);
predictBtn.addEventListener('click', predict);

loadLeagues();
