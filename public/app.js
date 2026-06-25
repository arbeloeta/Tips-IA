const compTabs = document.getElementById('comp-tabs');
const fixturesList = document.getElementById('fixtures-list');
const fixturesStatus = document.getElementById('fixtures-status');
const results = document.getElementById('results');

let LEAGUES = {};
let currentCompetition = null;
let selectedCard = null;

function setFixturesStatus(msg, isError = false) {
  fixturesStatus.textContent = msg || '';
  fixturesStatus.classList.toggle('error', isError);
}

function formatDate(iso, hideTime) {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    weekday: 'short', day: '2-digit', month: 'short',
    ...(hideTime ? {} : { hour: '2-digit', minute: '2-digit' }),
  });
}

async function loadStatus() {
  const res = await fetch('/api/status');
  const data = await res.json();
  LEAGUES = data.leagues;

  compTabs.innerHTML = '';
  Object.entries(LEAGUES).forEach(([code, name], i) => {
    const btn = document.createElement('button');
    btn.className = 'comp-tab' + (i === 0 ? ' active' : '');
    btn.textContent = name;
    btn.dataset.code = code;
    btn.addEventListener('click', () => selectCompetition(code));
    compTabs.appendChild(btn);
  });

  const firstCode = Object.keys(LEAGUES)[0];
  if (firstCode) selectCompetition(firstCode);
}

function selectCompetition(code) {
  currentCompetition = code;
  Array.from(compTabs.children).forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.code === code);
  });
  results.classList.add('hidden');
  loadFixtures(code);
}

async function loadFixtures(code) {
  fixturesList.innerHTML = '';
  setFixturesStatus('Cargando partidos...');

  const res = await fetch(`/api/fixtures?competition=${code}`);
  const data = await res.json();

  if (data.error) {
    setFixturesStatus(`No se pudieron cargar los partidos: ${data.error}`, true);
    return;
  }

  const fixtures = data.fixtures || [];
  if (fixtures.length === 0) {
    setFixturesStatus('No hay partidos disponibles para esta competición ahora mismo.', true);
    return;
  }
  setFixturesStatus('');

  const sorted = [...fixtures].sort((a, b) => new Date(a.date) - new Date(b.date));
  const upcoming = sorted.filter((f) => !f.played);
  const playedRecent = sorted.filter((f) => f.played).slice(-10);
  const toShow = [...playedRecent, ...upcoming].slice(0, 40);

  if (toShow.length === 0) {
    fixturesList.innerHTML = '<p class="empty-msg">No hay partidos próximos en el calendario todavía.</p>';
    return;
  }

  toShow.forEach((f) => {
    const card = document.createElement('div');
    card.className = 'fixture-card';
    const groupTag = f.group ? `<span class="fixture-group">${f.group}</span>` : '';
    card.innerHTML = `
      <div class="fixture-meta"><span>${formatDate(f.date, f.hideTime)}</span>${groupTag}</div>
      <div class="fixture-teams">
        <span class="fixture-team home">${f.home}</span>
        <span class="fixture-score ${f.played ? '' : 'tbd'}">${f.played ? f.score : 'vs'}</span>
        <span class="fixture-team away">${f.away}</span>
      </div>
    `;
    card.addEventListener('click', () => onFixtureClick(card, f));
    fixturesList.appendChild(card);
  });
}

async function onFixtureClick(card, fixture) {
  if (selectedCard) selectedCard.classList.remove('selected');
  card.classList.add('selected');
  selectedCard = card;

  setFixturesStatus('Calculando predicción...');

  try {
    const res = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ league: currentCompetition, home: fixture.home, away: fixture.away }),
    });
    const data = await res.json();

    if (data.error) {
      setFixturesStatus(data.error, true);
      results.classList.add('hidden');
      return;
    }

    setFixturesStatus('');
    renderResults(data, fixture);
    results.classList.remove('hidden');
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    requestAiAnalysis(data, fixture);
  } catch (e) {
    setFixturesStatus('Error de conexión al pedir la predicción.', true);
  }
}

async function requestAiAnalysis(predictionData, fixture) {
  const aiText = document.getElementById('ai-analysis');
  aiText.textContent = 'Generando análisis...';
  aiText.classList.add('loading');

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        home: fixture.home,
        away: fixture.away,
        competition: LEAGUES[currentCompetition],
        goles_esperados: predictionData.goles_esperados,
        mercados: predictionData.mercados,
      }),
    });
    const data = await res.json();
    aiText.classList.remove('loading');
    aiText.textContent = data.error ? `No se pudo generar el análisis: ${data.error}` : data.analysis;
  } catch (e) {
    aiText.classList.remove('loading');
    aiText.textContent = 'No se pudo generar el análisis (error de conexión).';
  }
}

function renderVerdict(markets, fixture) {
  const m1x2 = markets['1X2'];
  const pHome = m1x2['1 (Local)'];
  const pDraw = m1x2['X (Empate)'];
  const pAway = m1x2['2 (Visitante)'];

  document.getElementById('seg-home').style.flexBasis = `${pHome * 100}%`;
  document.getElementById('seg-draw').style.flexBasis = `${pDraw * 100}%`;
  document.getElementById('seg-away').style.flexBasis = `${pAway * 100}%`;

  document.getElementById('split-home-pct').textContent = (pHome * 100).toFixed(0);
  document.getElementById('split-draw-pct').textContent = (pDraw * 100).toFixed(0);
  document.getElementById('split-away-pct').textContent = (pAway * 100).toFixed(0);
  document.getElementById('split-home-name').textContent = fixture.home;
  document.getElementById('split-away-name').textContent = fixture.away;

  const top = Math.max(pHome, pDraw, pAway);
  const verdictText = document.getElementById('verdict-text');
  if (top === pDraw || (Math.abs(pHome - pAway) < 0.08 && top < 0.45)) {
    verdictText.textContent = `Partido muy igualado, sin favorito claro.`;
  } else if (top < 0.45) {
    const fav = pHome > pAway ? fixture.home : fixture.away;
    verdictText.textContent = `${fav} es ligero favorito, pero está bastante abierto.`;
  } else if (top < 0.62) {
    const fav = pHome > pAway ? fixture.home : fixture.away;
    verdictText.textContent = `${fav} es favorito (${(top * 100).toFixed(0)}%).`;
  } else {
    const fav = pHome > pAway ? fixture.home : fixture.away;
    verdictText.textContent = `${fav} es claro favorito (${(top * 100).toFixed(0)}%).`;
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

function renderResults(data, fixture) {
  document.getElementById('xg-home').textContent = data.goles_esperados.local.toFixed(2);
  document.getElementById('xg-away').textContent = data.goles_esperados.visitante.toFixed(2);
  document.getElementById('xg-home-tag').textContent = fixture.home;
  document.getElementById('xg-away-tag').textContent = fixture.away;

  renderVerdict(data.mercados, fixture);
  renderBars(document.getElementById('btts-bars'), data.mercados['Ambos marcan']);
  renderOverUnder(document.getElementById('ou-table'), data.mercados['Goles totales']);
  renderHandicap(document.getElementById('ah-table'), data.mercados['Hándicap asiático']);
  renderExactScores(document.getElementById('exact-scores'), data.mercados['Marcador exacto (top 10)']);
}

loadStatus();
