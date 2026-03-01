const express = require('express');
const {
  authenticatePresenter,
  logoutPresenter,
  requirePresenterAuth
} = require('../auth');
const {
  getMostActiveParticipants,
  getLikesTimeline,
  getState,
  listParticipants,
  resetRaffle,
  startPresentation
} = require('../storage');

const router = express.Router();

router.post('/auth', authenticatePresenter);
router.post('/logout', logoutPresenter);

router.get('/state', requirePresenterAuth, async (request, response) => {
  try {
    const state = await getState();
    return response.json({ ok: true, state });
  } catch (error) {
    return response.status(500).json({ ok: false, message: 'Unable to load state.' });
  }
});

router.get('/participants', requirePresenterAuth, async (request, response) => {
  try {
    const participants = await listParticipants();
    return response.json({ ok: true, participants });
  } catch (error) {
    return response.status(500).json({ ok: false, message: 'Unable to load participants.' });
  }
});

router.post('/start', requirePresenterAuth, async (request, response) => {
  try {
    const result = await startPresentation();
    return response.json({ ok: true, startedAt: result.startedAt });
  } catch (error) {
    return response.status(500).json({ ok: false, message: 'Unable to start presentation.' });
  }
});

router.get('/likes-timeline', requirePresenterAuth, async (request, response) => {
  try {
    const timeline = await getLikesTimeline();
    return response.json({ ok: true, timeline });
  } catch (error) {
    return response.status(500).json({ ok: false, message: 'Unable to load likes timeline.' });
  }
});

router.get('/likes-leaderboard', requirePresenterAuth, async (request, response) => {
  try {
    const top = await getMostActiveParticipants(15);
    return response.json({ ok: true, top });
  } catch (error) {
    return response.status(500).json({ ok: false, message: 'Unable to load likes leaderboard.' });
  }
});

router.post('/reset', requirePresenterAuth, async (request, response) => {
  try {
    await resetRaffle();
    return response.json({ ok: true });
  } catch (error) {
    return response.status(500).json({ ok: false, message: 'Unable to reset raffle.' });
  }
});

module.exports = router;