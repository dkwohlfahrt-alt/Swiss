// ---- Data ----
let players = JSON.parse(localStorage.getItem('players')) || [];
let tournament = null;

// ---- DOM Elements ----
const playersList = document.getElementById('players-list');
const activePlayersList = document.getElementById('active-players');
const pairingsList = document.getElementById('pairings');
const addPlayerBtn = document.getElementById('add-player');
const startTournamentBtn = document.getElementById('start-tournament');
const ageFilterContainer = document.getElementById('age-filter-container');
const standingsTable = document.querySelector('#standings tbody');
const printBtn = document.getElementById('print-pairings');
const nextRoundBtn = document.getElementById('next-round');

// ---- Age Filter ----
const ageFilterSelect = document.createElement('select');
ageFilterSelect.innerHTML = `
  <option value="">All Ages</option>
  <option value="U9">U9</option>
  <option value="U11">U11</option>
  <option value="U13">U13</option>
`;
ageFilterContainer.appendChild(ageFilterSelect);

// ---- Functions ----
function renderPlayers() {
  playersList.innerHTML = '';
  players.forEach((p) => {
    const li = document.createElement('li');
    li.textContent = `${p.name} (${p.ageGroup}) - ${p.rating} Elo`;
    playersList.appendChild(li);
  });
  localStorage.setItem('players', JSON.stringify(players));
}

// Add new player
addPlayerBtn.addEventListener('click', () => {
  const name = document.getElementById('new-player-name').value.trim();
  const rating = parseInt(document.getElementById('new-player-rating').value) || 1200;
  const ageGroup = document.getElementById('new-player-age').value;

  if (!["U9","U11","U13"].includes(ageGroup)) {
    alert("Age group must be U9, U11, or U13");
    return;
  }

  if (name) {
    players.push({ id: Date.now(), name, rating, ageGroup, active: true, points: 0 });
    renderPlayers();
    document.getElementById('new-player-name').value = '';
  }
});

// Elo Calculation
function updateElo(playerA, playerB, scoreA, K = 32) {
  const expectedA = 1 / (1 + Math.pow(10, (playerB.rating - playerA.rating)/400));
  const expectedB = 1 - expectedA;
  playerA.rating = Math.round(playerA.rating + K * (scoreA - expectedA));
  playerB.rating = Math.round(playerB.rating + K * ((1 - scoreA) - expectedB));
}

// Start new tournament
startTournamentBtn.addEventListener('click', () => {
  const selectedAge = ageFilterSelect.value;
  const activePlayers = players.filter(p => p.active && (selectedAge === "" || p.ageGroup === selectedAge));

  if (activePlayers.length < 2) {
    alert("Need at least 2 players for a tournament!");
    return;
  }

  activePlayers.forEach(p => p.points = 0);

  tournament = {
    players: activePlayers.map(p => p.id),
    rounds: [],
    currentRound: 1
  };

  renderActivePlayers();
  generatePairings();
  renderStandings();
});

// Render active players
function renderActivePlayers() {
  activePlayersList.innerHTML = '';
  const activePlayers = tournament.players.map(id => players.find(p => p.id === id));
  activePlayers.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.name} (${p.rating} Elo) - ${p.points} pts`;
    activePlayersList.appendChild(li);
  });
}

// Generate pairings
function generatePairings() {
  pairingsList.innerHTML = '';
  if (!tournament) return;

  const tournamentPlayers = tournament.players
    .map(id => players.find(p => p.id === id))
    .sort((a,b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.rating - a.rating;
    });

  const roundPairings = [];
  for (let i = 0; i < tournamentPlayers.length; i += 2) {
    const white = tournamentPlayers[i];
    const black = tournamentPlayers[i + 1];
    if (!black) {
      roundPairings.push({ white: white.id, black: null, result: 1 });
      continue;
    }
    roundPairings.push({ white: white.id, black: black.id, result: null });
  }

  tournament.rounds.push({ roundNumber: tournament.currentRound, pairings: roundPairings });
  renderPairings(roundPairings);
}

// Render pairings
function renderPairings(roundPairings) {
  pairingsList.innerHTML = '';
  const roundNumber = tournament.currentRound;
  const roundHeader = document.createElement('h4');
  roundHeader.textContent = `Round ${roundNumber} Pairings`;
  pairingsList.appendChild(roundHeader);

  roundPairings.forEach((p) => {
    const li = document.createElement('li');
    const white = players.find(pl => pl.id === p.white);
    const black = p.black ? players.find(pl => pl.id === p.black) : null;
    li.setAttribute('data-points', white.points);

    if (!black) {
      li.textContent = `${white.name} has a BYE (1 pt) - Current: ${white.points} pts`;
      pairingsList.appendChild(li);
      return;
    }

    li.textContent = `${white.name} (White, ${white.points} pts) vs ${black.name} (Black, ${black.points} pts)`;

    const select = document.createElement('select');
    select.innerHTML = `
      <option value="">--Result--</option>
      <option value="1">White wins</option>
      <option value="0.5">Draw</option>
      <option value="0">Black wins</option>
    `;
    select.addEventListener('change', () => {
      const score = parseFloat(select.value);
      p.result = score;
      updatePointsAndElo(p);
      renderStandings();
      renderPairings(roundPairings); // refresh to show updated points
    });

    li.appendChild(select);
    pairingsList.appendChild(li);
  });
}

// Update points and Elo
function updatePointsAndElo(pairing) {
  const white = players.find(pl => pl.id === pairing.white);
  const black = players.find(pl => pl.id === pairing.black);

  if (!black) {
    white.points += 1;
    renderActivePlayers();
    return;
  }

  if (pairing.result === null) return;

  white.points += pairing.result;
  black.points += (1 - pairing.result);

  updateElo(white, black, pairing.result);
  renderActivePlayers();
  renderPlayers();
}

// Render standings table
function renderStandings() {
  standingsTable.innerHTML = '';
  const tablePlayers = tournament.players.map(id => players.find(p => p.id === id))
    .sort((a,b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.rating - a.rating;
    });

  tablePlayers.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.name}</td><td>${p.ageGroup}</td><td>${p.points}</td><td>${p.rating}</td>`;
    standingsTable.appendChild(tr);
  });
}

// Next round
nextRoundBtn.addEventListener('click', () => {
  if (!tournament) return;
  const lastRound = tournament.rounds[tournament.currentRound - 1];
  if (lastRound.pairings.some(p => p.result === null)) {
    alert("Enter all results first!");
    return;
  }
  tournament.currentRound++;
  generatePairings();
  renderStandings();
});

// Print
printBtn.addEventListener('click', () => window.print());

// Initial render
renderPlayers();
renderStandings();
