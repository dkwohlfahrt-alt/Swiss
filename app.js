/* =========================
   DATA STORAGE
========================= */

let players = JSON.parse(localStorage.getItem("players")) || [];
let tournaments = JSON.parse(localStorage.getItem("tournaments")) || {
  u9: null,
  u11: null,
  u13: null
};

const K = 20;

function save() {
  localStorage.setItem("players", JSON.stringify(players));
  localStorage.setItem("tournaments", JSON.stringify(tournaments));
}

/* =========================
   PLAYER MANAGEMENT
========================= */

document.getElementById("add-player").onclick = () => {
  const name = document.getElementById("player-name").value.trim();
  const age = document.getElementById("age-group").value;

  if (!name) return;

  players.push({
    id: Date.now(),
    name,
    age,
    rating: 1200,
    active: false
  });

  document.getElementById("player-name").value = "";
  save();
  renderPlayers();
};

document.getElementById("clear-players").onclick = () => {
  if (confirm("Clear all players and tournaments?")) {
    players = [];
    tournaments = { u9: null, u11: null, u13: null };
    save();
    location.reload();
  }
};

function toggleActive(id) {
  const player = players.find(p => p.id === id);
  if (!player) return;

  player.active = !player.active;
  save();
  renderPlayers();
}

function removePlayer(id) {
  if (!confirm("Remove this player?")) return;

  players = players.filter(p => p.id !== id);
  save();
  renderPlayers();
}

function renderPlayers() {
  const container = document.getElementById("player-list");

  if (players.length === 0) {
    container.innerHTML = "<p>No players added yet.</p>";
    return;
  }

  let html = "<table><tr><th>Active</th><th>Name</th><th>Age</th><th>Rating</th><th>Remove</th></tr>";

  players.forEach(p => {
    html += `<tr>
      <td>
        <input type="checkbox"
          ${p.active ? "checked" : ""}
          onchange="toggleActive(${p.id})">
      </td>
      <td>${p.name}</td>
      <td>${p.age.toUpperCase()}</td>
      <td>${p.rating}</td>
      <td><button onclick="removePlayer(${p.id})">X</button></td>
    </tr>`;
  });

  html += "</table>";
  container.innerHTML = html;
}

/* =========================
   START DIVISION
========================= */

document.getElementById("start-division").onclick = () => {
  const div = document.getElementById("division-select").value;

 const selectedAges = Array.from(document.getElementById("division-select").selectedOptions)
                          .map(opt => opt.value);

const divisionPlayers = players
  .filter(p => selectedAges.includes(p.age) && p.active)
  .map(p => ({
    ...p,
    points: 0,
    opponents: []
  }));

  if (divisionPlayers.length < 2) {
    alert("Need at least 2 active players.");
    return;
  }

  tournaments[div] = {
    round: 1,
    players: divisionPlayers,
    rounds: [],
    archive: []
  };

  generatePairings(div);
  save();
  renderDivision(div);
};

/* =========================
   PAIRING ENGINE (NO REMATCH)
========================= */

function generatePairings(div) {
  const t = tournaments[div];
  const sorted = [...t.players].sort((a, b) => b.points - a.points);

  const pairings = [];
  const used = new Set();

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].id)) continue;

    let opponentFound = false;

    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(sorted[j].id)) continue;

      if (!sorted[i].opponents.includes(sorted[j].id)) {
        pairings.push({
          white: sorted[i],
          black: sorted[j],
          result: null
        });

        used.add(sorted[i].id);
        used.add(sorted[j].id);
        opponentFound = true;
        break;
      }
    }

    if (!opponentFound && !used.has(sorted[i].id)) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (!used.has(sorted[j].id)) {
          pairings.push({
            white: sorted[i],
            black: sorted[j],
            result: null
          });

          used.add(sorted[i].id);
          used.add(sorted[j].id);
          break;
        }
      }
    }
  }

  t.rounds.push(pairings);
}

/* =========================
   RESULT ENTRY
========================= */

function submitResult(div, boardIndex, result) {
  const t = tournaments[div];
  const round = t.rounds[t.rounds.length - 1];
  const game = round[boardIndex];

  if (game.result !== null) return;

  game.result = result;

  const white = game.white;
  const black = game.black;

  if (result === 1) white.points += 1;
  else if (result === 0) black.points += 1;
  else {
    white.points += 0.5;
    black.points += 0.5;
  }

  updateElo(white, black, result);

  white.opponents.push(black.id);
  black.opponents.push(white.id);

  save();
  renderDivision(div);
}

function formatResult(result) {
  if (result === 1) return "1-0";
  if (result === 0) return "0-1";
  return "½-½";
}

/* =========================
   ELO SYSTEM
========================= */

function updateElo(p1, p2, result) {
  const expected1 = 1 / (1 + 10 ** ((p2.rating - p1.rating) / 400));
  const expected2 = 1 - expected1;

  p1.rating = Math.round(p1.rating + K * (result - expected1));
  p2.rating = Math.round(p2.rating + K * ((1 - result) - expected2));
}

/* =========================
   ROUND LOCK
========================= */

function isRoundComplete(div) {
  const t = tournaments[div];
  if (!t || t.rounds.length === 0) return false;

  const currentRound = t.rounds[t.rounds.length - 1];
  return currentRound.every(game => game.result !== null);
}

document.getElementById("next-round").onclick = () => {
  const div = document.getElementById("division-select").value;
  const t = tournaments[div];
  if (!t) return;

  if (!isRoundComplete(div)) {
    alert("All results must be entered first.");
    return;
  }

  t.round++;
  generatePairings(div);
  save();
  renderDivision(div);
};

/* =========================
   ARCHIVE
========================= */

document.getElementById("archive-division").onclick = () => {
  const div = document.getElementById("division-select").value;
  if (!tournaments[div]) return;

  tournaments[div] = null;
  save();
  renderDivision(div);
};

/* =========================
   EXPORT CSV
========================= */

document.getElementById("export-division").onclick = () => {
  const div = document.getElementById("division-select").value;
  const t = tournaments[div];
  if (!t) return;

  let csv = "Name,Points,Rating\n";
  t.players.forEach(p => {
    csv += `${p.name},${p.points},${Math.round(p.rating)}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${div}_standings.csv`;
  a.click();
};

/* =========================
   RENDER DIVISION
========================= */

function renderDivision(div) {
  const container = document.getElementById("division-output");
  const t = tournaments[div];

  if (!t) {
    container.innerHTML = "<p>No active tournament.</p>";
    return;
  }

  let html = `<h3>${div.toUpperCase()} - Round ${t.round}</h3>`;
  const currentRound = t.rounds[t.rounds.length - 1];

  html += "<table><tr><th>Board</th><th>White</th><th>Black</th><th>Result</th></tr>";

  currentRound.forEach((game, i) => {
    html += `<tr>
      <td>${i + 1}</td>
      <td>${game.white.name}</td>
      <td>${game.black.name}</td>
      <td>
        ${
          game.result === null
            ? `
              <button onclick="submitResult('${div}', ${i}, 1)">1-0</button>
              <button onclick="submitResult('${div}', ${i}, 0.5)">½-½</button>
              <button onclick="submitResult('${div}', ${i}, 0)">0-1</button>
            `
            : formatResult(game.result)
        }
      </td>
    </tr>`;
  });

  html += "</table>";

  const pending = currentRound.filter(g => g.result === null).length;
  if (pending > 0) {
    html += `<p style="color:red;">${pending} game(s) pending</p>`;
  }

  html += "<h4>Standings</h4>";
  html += "<table><tr><th>Name</th><th>Pts</th><th>Rating</th></tr>";

  t.players
    .sort((a, b) => b.points - a.points)
    .forEach(p => {
      html += `<tr>
        <td>${p.name}</td>
        <td>${p.points}</td>
        <td>${Math.round(p.rating)}</td>
      </tr>`;
    });

  html += "</table>";

  container.innerHTML = html;

  document.getElementById("next-round").disabled = !isRoundComplete(div);
}

/* =========================
   INIT
========================= */

renderPlayers();

