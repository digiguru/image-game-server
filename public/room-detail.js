const STORAGE_KEY = 'image-game-server-recent-games';
const GAME_STATES = ['lobby', 'ideation', 'voting', 'results'];

function getRoomID() {
  const value = decodeURIComponent(globalThis.location.pathname.split('/').filter(Boolean).at(-1) || '');
  return /^[a-zA-Z0-9_-]{1,40}$/.test(value) ? value : 'default';
}

function getClientOrigin() {
  if (globalThis.location.hostname === 'localhost' || globalThis.location.hostname === '127.0.0.1') {
    return 'http://localhost:5173';
  }
  return 'https://image-game-client.vercel.app';
}

function loadRecentGames() {
  try {
    const value = JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter((game) => game && typeof game.roomID === 'string') : [];
  } catch {
    return [];
  }
}

function saveRecentGames(games) {
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(games.slice(0, 20)));
}

function rememberGame(roomID) {
  const now = new Date().toISOString();
  const games = loadRecentGames();
  const previous = games.find((game) => game.roomID === roomID);
  saveRecentGames([
    { roomID, createdAt: previous?.createdAt || now, lastOpenedAt: now },
    ...games.filter((game) => game.roomID !== roomID),
  ]);
}

function clientUrl(roomID, { host = false, state } = {}) {
  const url = new URL(host ? '/host' : '/', getClientOrigin());
  url.searchParams.set('room', roomID);
  if (state) url.searchParams.set('state', state);
  return url.toString();
}

function renderPhaseActions(roomID, currentState) {
  const container = document.querySelector('#phase-actions');
  container.replaceChildren();

  for (const state of GAME_STATES) {
    const link = document.createElement('a');
    link.className = `button phase-button${state === currentState ? ' selected' : ''}`;
    link.href = clientUrl(roomID, { host: true, state });
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = state[0].toUpperCase() + state.slice(1);
    if (state === currentState) link.setAttribute('aria-current', 'step');
    container.append(link);
  }
}

function renderPlayers(users) {
  const grid = document.querySelector('#player-grid');
  const empty = document.querySelector('#players-empty');
  grid.replaceChildren();
  empty.hidden = users.length !== 0;

  for (const user of users) {
    const article = document.createElement('article');
    article.className = 'player-card';

    const heading = document.createElement('h3');
    heading.textContent = user.name || 'Unnamed player';
    article.append(heading);

    if (user.image) {
      const image = document.createElement('img');
      image.src = user.image.startsWith('http') ? user.image : `data:image/jpeg;base64,${user.image}`;
      image.alt = user.prompt ? `Generated image for: ${user.prompt}` : `Generated image for ${user.name || 'player'}`;
      image.loading = 'lazy';
      article.append(image);
    }

    const prompt = document.createElement('p');
    prompt.innerHTML = '<strong>Prompt:</strong> ';
    prompt.append(document.createTextNode(user.prompt || 'Not submitted yet'));
    article.append(prompt);

    const votes = document.createElement('p');
    votes.innerHTML = '<strong>Votes:</strong> ';
    votes.append(document.createTextNode(String(Array.isArray(user.votes) ? user.votes.length : 0)));
    article.append(votes);

    grid.append(article);
  }
}

function renderGamePicker(currentRoomID) {
  const select = document.querySelector('#game-select');
  const games = loadRecentGames();
  select.replaceChildren();

  for (const game of games) {
    const option = new Option(game.roomID, game.roomID, false, game.roomID === currentRoomID);
    select.add(option);
  }

  if (!games.some((game) => game.roomID === currentRoomID)) {
    select.add(new Option(currentRoomID, currentRoomID, true, true));
  }
}

async function refreshSnapshot() {
  const roomID = getRoomID();
  const status = document.querySelector('#room-status');

  try {
    const response = await fetch(`/room/${encodeURIComponent(roomID)}/data`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Snapshot failed (${response.status})`);
    const game = await response.json();
    status.textContent = `${game.state} · ${game.generator} · ${game.playerCount} player${game.playerCount === 1 ? '' : 's'}`;
    renderPhaseActions(roomID, game.state);
    renderPlayers(Array.isArray(game.users) ? game.users : []);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Could not load the game snapshot.';
    renderPhaseActions(roomID);
  }
}

const roomID = getRoomID();
rememberGame(roomID);
document.querySelector('#room-id').textContent = roomID;
document.title = `Game ${roomID} · Image Game Server`;
document.querySelector('#open-host').href = clientUrl(roomID, { host: true });
document.querySelector('#open-player').href = clientUrl(roomID);
document.querySelector('#refresh-snapshot').addEventListener('click', refreshSnapshot);
document.querySelector('#open-selected-game').addEventListener('click', () => {
  const selected = document.querySelector('#game-select').value;
  if (selected) globalThis.location.assign(`/room/${encodeURIComponent(selected)}`);
});

renderGamePicker(roomID);
refreshSnapshot();
globalThis.setInterval(refreshSnapshot, 5000);
