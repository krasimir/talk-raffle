const express = require('express');
const {
  addEntry,
  getParticipantById,
  getLikesTimeline,
  getMostActiveParticipants,
  listParticipants,
  recordLikeHit
} = require('../storage');

const router = express.Router();

router.post('/register', async (request, response) => {
  try {
    const result = await addEntry({
      name: request.body.name
    });

    if (!result.ok) {
      const statusByCode = {
        INVALID_NAME: 400
      };

      return response.status(statusByCode[result.code] || 400).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }

    return response.status(201).json({
      ok: true,
      entry: result.entry
    });
  } catch (error) {
    return response.status(500).json({ ok: false, message: 'Unable to register right now.' });
  }
});

router.get('/participants', async (request, response) => {
  try {
    const participants = await listParticipants();
    return response.json({ ok: true, participants });
  } catch (error) {
    return response.status(500).json({ ok: false, message: 'Unable to load participants.' });
  }
});

router.get('/participant/:id', async (request, response) => {
  try {
    const participant = await getParticipantById(request.params.id);
    if (!participant) {
      return response.status(404).json({ ok: false, message: 'Participant not found.' });
    }

    return response.json({ ok: true, participant });
  } catch (error) {
    return response.status(500).json({ ok: false, message: 'Unable to load participant.' });
  }
});

router.post('/like', async (request, response) => {
  try {
    const result = await recordLikeHit({ participantId: request.body.participantId });

    if (!result.ok) {
      const statusByCode = {
        INVALID_PARTICIPANT: 400,
        UNKNOWN_PARTICIPANT: 404,
        PRESENTATION_NOT_STARTED: 409
      };

      return response.status(statusByCode[result.code] || 400).json({
        ok: false,
        code: result.code,
        message: result.message
      });
    }

    return response.status(201).json({ ok: true, like: result.like });
  } catch (error) {
    return response.status(500).json({ ok: false, message: 'Unable to record like right now.' });
  }
});

router.get('/likes-timeline', async (request, response) => {
  try {
    const timeline = await getLikesTimeline();
    return response.json({ ok: true, timeline });
  } catch (error) {
    return response.status(500).json({ ok: false, message: 'Unable to load likes timeline.' });
  }
});

router.get('/likes-leaderboard', async (request, response) => {
  try {
    const top = await getMostActiveParticipants(15);
    return response.json({ ok: true, top });
  } catch (error) {
    return response.status(500).json({ ok: false, message: 'Unable to load likes leaderboard.' });
  }
});

module.exports = router;