const STORAGE_KEY = 'image-game-server-recent-games';
const GAME_STATES = ['lobby', 'ideation', 'voting', 'results'];
const STATE_META = {
  lobby: { label: 'Lobby', description: 'Gather players' },
  ideation: { label: 'Ideation', description: 'Create prompts' },
  voting: { label: 'Voting', description: 'Pick favourites' },
  results: { label: 'Results', description: 'Celebrate' },
};
const SNAPSHOT_INTERVAL_MS = 1500;

let renderedState;
let renderedPlayerSignature = '';
let refreshing = false;

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

function prefersReducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
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
  const currentIndex = GAME_STATES.indexOf(currentState);
  container.replaceChildren();

  GAME_STATES.forEach((state, index) => {
    const meta = STATE_META[state];
    const link = document.createElement('a');
    const stateClass = state === currentState ? ' current' : index < currentIndex ? ' complete' : '';
    link.className = `phase-step phase-${state}${stateClass}`;
    link.href = clientUrl(roomID, { host: true, state });
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.setProperty('--phase-index', index);

    const marker = document.createElement('span');
    marker.className = 'phase-marker';
    marker.setAttribute('aria-hidden', 'true');
    marker.textContent = String(index + 1);

    const copy = document.createElement('span');
    copy.className = 'phase-copy';

    const label = document.createElement('strong');
    label.textContent = meta.label;
    copy.append(label);

    const description = document.createElement('small');
    description.textContent = meta.description;
    copy.append(description);

    link.append(marker, copy);
    if (state === currentState) link.setAttribute('aria-current', 'step');
    container.append(link);
  });
}

function playerSignature(users) {
  return JSON.stringify(users.map((user) => ({
    userID: user.userID,
    name: user.name,
    prompt: user.prompt,
    image: user.image,
    votes: Array.isArray(user.votes) ? user.votes.length : 0,
  })));
}

function renderPlayers(users) {
  const signature = playerSignature(users);
  if (signature === renderedPlayerSignature) return;
  renderedPlayerSignature = signature;

  const grid = document.querySelector('#player-grid');
  const empty = document.querySelector('#players-empty');
  grid.replaceChildren();
  empty.hidden = users.length !== 0;

  users.forEach((user, index) => {
    const article = document.createElement('article');
    article.className = 'player-card player-card-enter';
    article.style.setProperty('--card-index', index);

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
    const promptLabel = document.createElement('strong');
    promptLabel.textContent = 'Prompt: ';
    prompt.append(promptLabel, document.createTextNode(user.prompt || 'Not submitted yet'));
    article.append(prompt);

    const votes = document.createElement('p');
    const voteLabel = document.createElement('strong');
    voteLabel.textContent = 'Votes: ';
    votes.append(voteLabel, document.createTextNode(String(Array.isArray(user.votes) ? user.votes.length : 0)));
    article.append(votes);

    grid.append(article);
  });
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

function renderStatus(game) {
  const status = document.querySelector('#room-status');
  const meta = STATE_META[game.state] || { label: game.state, description: '' };
  status.replaceChildren();

  const phase = document.createElement('strong');
  phase.className = 'status-phase';
  phase.textContent = meta.label;

  const detail = document.createElement('span');
  detail.textContent = `${meta.description} · ${game.generator} · ${game.playerCount} player${game.playerCount === 1 ? '' : 's'}`;

  status.append(phase, detail);
}

function celebrateResults() {
  if (prefersReducedMotion()) return;

  const burst = document.createElement('div');
  burst.className = 'state-burst';
  burst.setAttribute('aria-hidden', 'true');

  for (let index = 0; index < 18; index += 1) {
    const particle = document.createElement('span');
    particle.style.setProperty('--particle-index', index);
    burst.append(particle);
  }

  document.body.append(burst);
  globalThis.setTimeout(() => burst.remove(), 1800);
}

function animatePhaseChange(nextState) {
  if (prefersReducedMotion()) return;

  const main = document.querySelector('main');
  const grid = document.querySelector('#player-grid');
  main.classList.remove('phase-change');
  grid.classList.remove('phase-grid-change');

  globalThis.requestAnimationFrame(() => {
    main.classList.add('phase-change');
    grid.classList.add('phase-grid-change');
  });

  globalThis.setTimeout(() => {
    main.classList.remove('phase-change');
    grid.classList.remove('phase-grid-change');
  }, 950);

  if (nextState === 'results') celebrateResults();
}

function applySnapshot(roomID, game) {
  const firstRender = renderedState === undefined;
  const stateChanged = !firstRender && renderedState !== game.state;
  const phaseNeedsRender = firstRender || stateChanged;

  const updateDOM = () => {
    document.body.dataset.gameState = game.state;
    renderStatus(game);
    if (phaseNeedsRender) renderPhaseActions(roomID, game.state);
    renderPlayers(Array.isArray(game.users) ? game.users : []);
  };

  if (stateChanged && !prefersReducedMotion() && typeof document.startViewTransition === 'function') {
    document.startViewTransition(updateDOM);
  } else {
    updateDOM();
  }

  if (stateChanged) animatePhaseChange(game.state);
  renderedState = game.state;
}

async function refreshSnapshot() {
  if (refreshing) return;
  refreshing = true;

  const roomID = getRoomID();
  const status = document.querySelector('#room-status');

  try {
    const response = await fetch(`/room/${encodeURIComponent(roomID)}/data`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Snapshot failed (${response.status})`);
    const game = await response.json();
    applySnapshot(roomID, game);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Could not load the game snapshot.';
    renderPhaseActions(roomID);
  } finally {
    refreshing = false;
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
globalThis.setInterval(refreshSnapshot, SNAPSHOT_INTERVAL_MS);
