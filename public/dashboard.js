const STORAGE_KEY = 'image-game-server-recent-games';
const MAX_RECENT_GAMES = 20;

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
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(games.slice(0, MAX_RECENT_GAMES)));
}

function rememberGame(roomID) {
  const now = new Date().toISOString();
  const games = loadRecentGames();
  const previous = games.find((game) => game.roomID === roomID);
  const game = {
    roomID,
    createdAt: previous?.createdAt || now,
    lastOpenedAt: now,
  };
  saveRecentGames([game, ...games.filter((item) => item.roomID !== roomID)]);
  return game;
}

function hostUrl(roomID) {
  const url = new URL('/host', getClientOrigin());
  url.searchParams.set('room', roomID);
  return url.toString();
}

function renderGames() {
  const games = loadRecentGames();
  const select = document.querySelector('#game-select');
  const empty = document.querySelector('#games-empty');
  const openButton = document.querySelector('#open-game-details');

  select.replaceChildren();

  if (games.length === 0) {
    const option = new Option('No recent games', '');
    select.add(option);
    select.disabled = true;
    openButton.disabled = true;
    empty.hidden = false;
    return;
  }

  for (const game of games) {
    const option = new Option(game.roomID, game.roomID);
    select.add(option);
  }

  select.disabled = false;
  openButton.disabled = false;
  empty.hidden = true;
}

async function createGame() {
  const button = document.querySelector('#start-game');
  const status = document.querySelector('#new-game-status');
  const fallback = document.querySelector('#popup-fallback');
  const popup = globalThis.open('about:blank', '_blank');

  if (popup) {
    popup.opener = null;
    popup.document.title = 'Creating Image Game…';
    popup.document.body.textContent = 'Creating game…';
  }

  button.disabled = true;
  status.textContent = 'Creating game…';
  fallback.hidden = true;

  try {
    const response = await fetch('/room', { method: 'POST' });
    if (!response.ok) throw new Error(`Game creation failed (${response.status})`);

    const game = await response.json();
    rememberGame(game.id);
    renderGames();

    status.textContent = `Game ${game.id} created in the lobby.`;
    const url = hostUrl(game.id);

    if (popup) popup.location.replace(url);
    fallback.href = url;
    fallback.textContent = `Open host for ${game.id}`;
    fallback.hidden = Boolean(popup);
  } catch (error) {
    if (popup) popup.close();
    status.textContent = error instanceof Error ? error.message : 'Could not create the game.';
  } finally {
    button.disabled = false;
  }
}

function openSelectedGame() {
  const roomID = document.querySelector('#game-select').value;
  if (!roomID) return;
  rememberGame(roomID);
  globalThis.location.assign(`/room/${encodeURIComponent(roomID)}`);
}

document.querySelector('#start-game').addEventListener('click', createGame);
document.querySelector('#open-game-details').addEventListener('click', openSelectedGame);
document.querySelector('#game-select').addEventListener('change', (event) => {
  if (event.target.value) rememberGame(event.target.value);
});

renderGames();
