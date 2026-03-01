(function bootstrap() {
  const page = document.querySelector('[data-page]');
  if (!page) {
    return;
  }

  if (page.dataset.page === 'register') {
    setupRegisterPage();
  }

  if (page.dataset.page === 'presenter') {
    setupPresenterPage();
  }

  if (page.dataset.page === 'draw') {
    setupDrawScreenPage();
  }

  if (page.dataset.page === 'like') {
    setupLikePage();
  }
})();

function setMessage(element, message, type) {
  if (!element) {
    return;
  }

  element.textContent = message || '';
  element.classList.remove('text-red-700', 'text-green-700');

  if (type === 'error') {
    element.classList.add('text-red-700');
  }

  if (type === 'success') {
    element.classList.add('text-green-700');
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    payload = {};
  }

  if (!response.ok) {
    const error = new Error(payload.message || 'Request failed.');
    error.status = response.status;
    throw error;
  }

  return payload;
}

function setupRegisterPage() {
  const form = document.getElementById('register-form');
  const message = document.getElementById('register-message');
  const button = document.getElementById('register-button');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(message, 'Submitting...', null);
    button.disabled = true;

    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') || '')
    };

    try {
      const result = await fetchJson('/api/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const participantId = result?.entry?.id;
      const participantName = result?.entry?.name;
      if (participantId) {
        window.localStorage.setItem('bookRaffleParticipantId', participantId);
        if (participantName) {
          window.localStorage.setItem('bookRaffleParticipantName', participantName);
        }
        window.location.href = `/like?participant=${encodeURIComponent(participantId)}`;
        return;
      }

      setMessage(message, 'Registered, but could not open like page.', 'error');
    } catch (error) {
      setMessage(message, error.message || 'Unable to register.', 'error');
    } finally {
      button.disabled = false;
    }
  });
}

function setupPresenterPage() {
  const authForm = document.getElementById('auth-form');
  const authPanel = document.getElementById('auth-panel');
  const controlsPanel = document.getElementById('controls-panel');
  const authMessage = document.getElementById('auth-message');
  const presenterMessage = document.getElementById('presenter-message');
  const presentationStart = document.getElementById('presentation-start');
  const participantsList = document.getElementById('participants-list');
  const participantsCount = document.getElementById('participants-count');
  const winnerBox = document.getElementById('winner-box');
  const startButton = document.getElementById('start-button');
  const refreshButton = document.getElementById('refresh-button');
  const resetButton = document.getElementById('reset-button');
  const logoutButton = document.getElementById('logout-button');

  async function unlockPresenter(pin) {
    await fetchJson('/api/presenter/auth', {
      method: 'POST',
      body: JSON.stringify({ pin })
    });

    authPanel.classList.add('hidden');
    controlsPanel.classList.remove('hidden');
    await loadParticipants();
  }

  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const pin = String(new FormData(authForm).get('pin') || '');

    try {
      await unlockPresenter(pin);
      authForm.reset();
      setMessage(authMessage, '', null);
    } catch (error) {
      setMessage(authMessage, error.message || 'Authentication failed.', 'error');
    }
  });


  let participants = [];

  function renderPresentationStart(startedAt) {
    if (!presentationStart) {
      return;
    }

    if (!startedAt) {
      presentationStart.textContent = 'Presentation start: not started';
      return;
    }

    const displayTime = new Date(startedAt).toLocaleTimeString();
    presentationStart.textContent = `Presentation start: ${displayTime}`;
  }

  function renderParticipants(highlightedId) {
    participantsList.innerHTML = '';

    if (!participants.length) {
      participantsList.innerHTML = '<span class="pill">No participants yet</span>';
      participantsCount.textContent = '0 participants';
      return;
    }

    participantsCount.textContent = `${participants.length} participants`;

    for (const participant of participants) {
      const chip = document.createElement('span');
      chip.className = `pill${participant.id === highlightedId ? ' winner' : ''}`;
      chip.textContent = participant.name;
      participantsList.appendChild(chip);
    }
  }

  async function loadParticipants() {
    const [participantsResponse] = await Promise.all([fetchJson('/api/presenter/participants')]);

    participants = Array.isArray(participantsResponse.participants)
      ? participantsResponse.participants.slice()
      : [];

    renderParticipants();
  }

  async function loadPresenterState() {
    const response = await fetchJson('/api/presenter/state');
    renderPresentationStart(response?.state?.presentationStartedAt || null);
  }

  startButton.addEventListener('click', async () => {
    if (confirm('Are you sure?')) {
      try {
        const response = await fetchJson('/api/presenter/start', { method: 'POST' });
        const started = new Date(response.startedAt).toLocaleTimeString();
        setMessage(presenterMessage, `Presentation started at ${started}.`, 'success');
        renderPresentationStart(response.startedAt);
      } catch (error) {
        setMessage(presenterMessage, error.message || 'Unable to start presentation.', 'error');
      }
    }
  });

  refreshButton.addEventListener('click', async () => {
    try {
      await Promise.all([loadParticipants(), loadPresenterState()]);
      setMessage(presenterMessage, 'Participant list refreshed.', 'success');
    } catch (error) {
      setMessage(presenterMessage, error.message || 'Unable to load participants.', 'error');
    }
  });

  if (resetButton) {
    resetButton.addEventListener('click', async () => {
      if (!window.confirm('Reset all participants?')) {
        return;
      }

      try {
        await fetchJson('/api/presenter/reset', { method: 'POST' });
        participants = [];
        renderParticipants();
        renderPresentationStart(null);
        winnerBox.classList.add('hidden');
        winnerBox.textContent = '';
        setMessage(presenterMessage, 'Raffle reset completed.', 'success');
      } catch (error) {
        setMessage(presenterMessage, error.message || 'Unable to reset raffle.', 'error');
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      try {
        await fetchJson('/api/presenter/logout', { method: 'POST' });
      } catch (error) {
        // Ignore and still lock UI.
      }

      controlsPanel.classList.add('hidden');
      authPanel.classList.remove('hidden');
      participants = [];
      renderParticipants();
      winnerBox.classList.add('hidden');
      winnerBox.textContent = '';
      setMessage(presenterMessage, '', null);
    });
  }

  loadParticipants()
    .then(async () => {
      await loadPresenterState();
      authPanel.classList.add('hidden');
      controlsPanel.classList.remove('hidden');
      setMessage(authMessage, '', null);
    })
    .catch(() => {
      // No active presenter cookie session yet.
    });
}

function setupDrawScreenPage() {
  const participantsList = document.getElementById('participants-list');
  const participantsCount = document.getElementById('participants-count');
  const presenterMessage = document.getElementById('presenter-message');
  const winnerBox = document.getElementById('winner-box');
  const refreshButton = document.getElementById('refresh-button');
  const drawButton = document.getElementById('draw-button');
  const winnerHistory = document.getElementById('winner-history');
  const likesSummary = document.getElementById('likes-summary');
  const likesChart = document.getElementById('likes-chart');
  const likesLeaderboard = document.getElementById('likes-leaderboard');

  let allParticipants = [];
  const pickedIds = new Set();
  const pickedWinners = [];

  function remainingParticipants() {
    return allParticipants.filter((participant) => !pickedIds.has(participant.id));
  }

  function renderWinnerHistory() {
    winnerHistory.innerHTML = '';

    if (!pickedWinners.length) {
      winnerHistory.innerHTML = '<span class="pill">No winners picked yet</span>';
      return;
    }

    for (const winner of pickedWinners) {
      const chip = document.createElement('span');
      chip.className = 'pill winner';
      chip.textContent = winner.name;
      winnerHistory.appendChild(chip);
    }
  }

  function renderParticipants(chips) {
    participantsList.innerHTML = '';

    if (!chips.length) {
      participantsList.innerHTML = '<span class="pill">No participants available</span>';
      return;
    }

    for (const participant of chips) {
      const chip = document.createElement('span');
      chip.className = 'pill';
      chip.textContent = participant.name;
      participantsList.appendChild(chip);
    }
  }

  function renderState() {
    const remaining = remainingParticipants();
    participantsCount.textContent = `${remaining.length} remaining / ${allParticipants.length} total`;
    renderParticipants(remaining);
    renderWinnerHistory();
  }

  function formatSecond(second) {
    const minutes = Math.floor(second / 60);
    const seconds = second % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function renderLikesChart(timelineResponse) {
    likesChart.innerHTML = '';

    const timeline = Array.isArray(timelineResponse.timeline) ? timelineResponse.timeline : [];
    const startedAt = timelineResponse.startedAt;
    const totalLikes = Number(timelineResponse.totalLikes || 0);

    if (!startedAt) {
      likesSummary.textContent = 'Presentation has not started yet.';
      return;
    }

    likesSummary.textContent = `Total likes: ${totalLikes}`;

    if (!timeline.length) {
      likesChart.innerHTML = '<span class="pill">No likes yet</span>';
      return;
    }

    const maxSecond = Math.max(...timeline.map((point) => Number(point.second || 0)), 0);
    const maxCount = Math.max(...timeline.map((point) => point.count), 1);
    const chartWidth = likesChart.clientWidth || 800;
    const barWidthPx = Math.max(1, Math.floor(chartWidth / Math.max(timeline.length * 1.2, 140)));

    likesSummary.textContent = `Total likes: ${totalLikes} · Timeline: 00:00 to ${formatSecond(maxSecond)}`;

    for (const point of timeline) {
      const second = Number(point.second || 0);
      const ratio = maxSecond > 0 ? second / maxSecond : 0;
      const bar = document.createElement('div');
      bar.className = 'chart-bar';
      bar.style.height = `${Math.max(8, Math.round((point.count / maxCount) * 120))}px`;
      bar.style.width = `${barWidthPx}px`;
      bar.style.left = `${Math.round(ratio * Math.max(0, chartWidth - barWidthPx))}px`;
      bar.title = `${formatSecond(point.second)} · ${point.count} likes`;

      likesChart.appendChild(bar);
    }
  }

  function renderLikesLeaderboard(items) {
    likesLeaderboard.innerHTML = '';

    const top = Array.isArray(items) ? items : [];
    if (!top.length) {
      likesLeaderboard.innerHTML = '<span class="pill">No likes yet</span>';
      return;
    }

    for (let index = 0; index < top.length; index += 1) {
      const row = top[index];
      const item = document.createElement('div');
      item.className = 'leaderboard-row';

      const rankName = document.createElement('span');
      rankName.textContent = `#${index + 1} ${row.name}`;

      const likes = document.createElement('span');
      likes.textContent = `${row.likes}`;

      item.appendChild(rankName);
      item.appendChild(likes);
      likesLeaderboard.appendChild(item);
    }
  }

  async function loadLikesTimeline() {
    const response = await fetchJson('/api/likes-timeline');
    renderLikesChart(response.timeline || {});
  }

  async function loadLikesLeaderboard() {
    const response = await fetchJson('/api/likes-leaderboard');
    renderLikesLeaderboard(response.top || []);
  }

  async function loadParticipants() {
    const response = await fetchJson('/api/participants');
    allParticipants = Array.isArray(response.participants) ? response.participants.slice() : [];

    const ids = new Set(allParticipants.map((participant) => participant.id));
    for (const id of [...pickedIds]) {
      if (!ids.has(id)) {
        pickedIds.delete(id);
      }
    }

    for (let index = pickedWinners.length - 1; index >= 0; index -= 1) {
      if (!ids.has(pickedWinners[index].id)) {
        pickedWinners.splice(index, 1);
      }
    }

    renderState();
  }

  async function runDraw() {
    const remaining = remainingParticipants();
    if (!remaining.length) {
      setMessage(presenterMessage, 'No remaining participants to draw from.', 'error');
      return;
    }

    drawButton.disabled = true;
    setMessage(presenterMessage, 'Mixing names...', null);
    winnerBox.classList.add('hidden');
    winnerBox.textContent = '';

    const mixed = remaining.slice();
    for (let cycle = 0; cycle < 8; cycle += 1) {
      shuffleInPlace(mixed);
      renderParticipants(mixed);
      await new Promise((resolve) => setTimeout(resolve, 140));
    }

    const winner = mixed[Math.floor(Math.random() * mixed.length)];
    pickedIds.add(winner.id);
    pickedWinners.push(winner);

    renderState();
    winnerBox.classList.remove('hidden');
    winnerBox.innerHTML = `<strong>Winner #${pickedWinners.length}:</strong> ${winner.name}`;
    setMessage(presenterMessage, 'Winner picked client-side and excluded from next draws.', 'success');
    drawButton.disabled = false;
  }

  refreshButton.addEventListener('click', async () => {
    try {
      await Promise.all([loadParticipants(), loadLikesTimeline(), loadLikesLeaderboard()]);
      setMessage(presenterMessage, 'Participant list refreshed.', 'success');
    } catch (error) {
      setMessage(presenterMessage, error.message || 'Unable to load participants.', 'error');
    }
  });

  drawButton.addEventListener('click', () => {
    runDraw().catch((error) => {
      setMessage(presenterMessage, error.message || 'Unable to draw winner.', 'error');
      drawButton.disabled = false;
    });
  });

  Promise.all([loadParticipants(), loadLikesTimeline(), loadLikesLeaderboard()]).catch((error) => {
    setMessage(presenterMessage, error.message || 'Unable to load participants.', 'error');
  });
}

function setupLikePage() {
  const likeButton = document.getElementById('like-button');
  const likeMessage = document.getElementById('like-message');
  const participantNameLabel = document.getElementById('participant-name');
  const params = new URLSearchParams(window.location.search);
  const queryParticipantId = params.get('participant');

  if (queryParticipantId) {
    window.localStorage.setItem('bookRaffleParticipantId', queryParticipantId);
  }

  const participantId = queryParticipantId || window.localStorage.getItem('bookRaffleParticipantId');
  const cachedParticipantName = window.localStorage.getItem('bookRaffleParticipantName');

  if (participantNameLabel) {
    participantNameLabel.textContent = cachedParticipantName || 'Loading participant...';
  }

  if (!participantId) {
    likeButton.disabled = true;
    setMessage(likeMessage, 'Missing participant session. Please register again.', 'error');
    return;
  }

  fetchJson(`/api/participant/${encodeURIComponent(participantId)}`)
    .then((response) => {
      const name = response?.participant?.name;
      if (name) {
        window.localStorage.setItem('bookRaffleParticipantName', name);
      }

      if (participantNameLabel) {
        participantNameLabel.textContent = name || cachedParticipantName || 'Unknown participant';
      }
    })
    .catch(() => {
      if (participantNameLabel) {
        participantNameLabel.textContent = cachedParticipantName || 'Unknown participant';
      }
    });

  let isPending = false;

  likeButton.addEventListener('click', async () => {
    if (isPending) {
      return;
    }

    isPending = true;
    likeButton.disabled = true;
    setMessage(likeMessage, 'Sending your like...', null);

    try {
      const response = await fetchJson('/api/like', {
        method: 'POST',
        body: JSON.stringify({ participantId })
      });

      const elapsedSecond = Math.floor(Number(response.like?.elapsedMs || 0) / 1000);
      setMessage(likeMessage, `Liked! Time +${elapsedSecond}s`, 'success');
    } catch (error) {
      setMessage(likeMessage, error.message || 'Unable to record like.', 'error');
    } finally {
      isPending = false;
      likeButton.disabled = false;
    }
  });
}

function shuffleInPlace(list) {
  for (let index = list.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [list[index], list[randomIndex]] = [list[randomIndex], list[index]];
  }
}