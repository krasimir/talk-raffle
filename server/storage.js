const { MongoClient } = require('mongodb');
const config = require('./config');

const MAX_NAME_LENGTH = 120;
const RANDOM_SUFFIX_LENGTH = 8;
const MAX_BASE_NAME_LENGTH = MAX_NAME_LENGTH - RANDOM_SUFFIX_LENGTH - 1;

let mongoClient;
let participantsCollection;
let likesCollection;
let metaCollection;

function normalizeName(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_BASE_NAME_LENGTH);
}

function randomDigits(length) {
  let result = '';

  for (let index = 0; index < length; index += 1) {
    result += Math.floor(Math.random() * 10);
  }

  return result;
}

function now() {
  return new Date().toISOString();
}

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function ensureCollections() {
  if (participantsCollection && likesCollection && metaCollection) {
    return {
      participants: participantsCollection,
      likes: likesCollection,
      meta: metaCollection
    };
  }

  const mongoUri = config.mongo.uri;
  if (!mongoUri) {
    throw new Error('MongoDB URI is missing in secrets/config.js');
  }

  mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();

  const db = mongoClient.db(config.mongo.dbName);
  const participantsName = config.mongo.collection;
  const likesName = `${config.mongo.collection}_likes`;
  const metaName = `${config.mongo.collection}_meta`;

  participantsCollection = db.collection(participantsName);
  likesCollection = db.collection(likesName);
  metaCollection = db.collection(metaName);

  try {
    await participantsCollection.dropIndex('email_1');
  } catch (error) {
    if (error.codeName !== 'IndexNotFound') {
      throw error;
    }
  }

  await participantsCollection.createIndex({ id: 1 }, { unique: true });
  await likesCollection.createIndex({ participantId: 1, createdAt: 1 });

  return {
    participants: participantsCollection,
    likes: likesCollection,
    meta: metaCollection
  };
}

async function getPresentationStartedAt(meta) {
  const record = await meta.findOne({ _id: 'presentation' }, { projection: { _id: 0, startedAt: 1 } });
  return record?.startedAt || null;
}

async function addEntry(payload) {
  const name = normalizeName(payload.name);

  if (!name) {
    return { ok: false, code: 'INVALID_NAME', message: 'Name is required.' };
  }

  const { participants } = await ensureCollections();
  const generatedName = `${name}_${randomDigits(RANDOM_SUFFIX_LENGTH)}`;
  const entry = {
    id: randomId(),
    name: generatedName,
    createdAt: now()
  };

  await participants.insertOne(entry);
  return { ok: true, entry: { id: entry.id, name: entry.name, createdAt: entry.createdAt } };
}

async function listParticipants() {
  const { participants } = await ensureCollections();

  return participants
    .find({}, { projection: { _id: 0, id: 1, name: 1, createdAt: 1 } })
    .sort({ createdAt: 1 })
    .toArray();
}

async function getParticipantById(participantId) {
  const id = typeof participantId === 'string' ? participantId.trim() : '';
  if (!id) {
    return null;
  }

  const { participants } = await ensureCollections();
  return participants.findOne({ id }, { projection: { _id: 0, id: 1, name: 1, createdAt: 1 } });
}

async function startPresentation() {
  const { meta } = await ensureCollections();
  const startedAt = now();

  await meta.updateOne(
    { _id: 'presentation' },
    { $set: { startedAt } },
    { upsert: true }
  );

  return { startedAt };
}

async function recordLikeHit(payload) {
  const participantId = typeof payload.participantId === 'string' ? payload.participantId.trim() : '';
  if (!participantId) {
    return { ok: false, code: 'INVALID_PARTICIPANT', message: 'Participant ID is required.' };
  }

  const { participants, likes, meta } = await ensureCollections();
  const participant = await participants.findOne({ id: participantId }, { projection: { _id: 0, id: 1 } });
  if (!participant) {
    return { ok: false, code: 'UNKNOWN_PARTICIPANT', message: 'Participant not found.' };
  }

  const startedAt = await getPresentationStartedAt(meta);
  if (!startedAt) {
    return { ok: false, code: 'PRESENTATION_NOT_STARTED', message: 'Presentation has not started yet.' };
  }

  const hitTime = new Date();
  const elapsedMs = Math.max(0, hitTime.getTime() - new Date(startedAt).getTime());

  const like = {
    id: randomId(),
    participantId,
    createdAt: hitTime.toISOString(),
    elapsedMs
  };

  await likes.insertOne(like);
  return { ok: true, like: { id: like.id, elapsedMs: like.elapsedMs, createdAt: like.createdAt } };
}

async function getLikesTimeline() {
  const { likes, meta } = await ensureCollections();
  const startedAt = await getPresentationStartedAt(meta);

  const likeEvents = await likes
    .find({}, { projection: { _id: 0, elapsedMs: 1, createdAt: 1 } })
    .sort({ createdAt: 1 })
    .toArray();

  const bucketMs = 5000;
  const bucketMap = new Map();
  for (const event of likeEvents) {
    const elapsedMs = Number(event.elapsedMs || 0);
    const bucketSecond = Math.floor(elapsedMs / bucketMs) * 5;
    bucketMap.set(bucketSecond, (bucketMap.get(bucketSecond) || 0) + 1);
  }

  const timeline = [...bucketMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([second, count]) => ({ second, count }));

  return {
    startedAt,
    totalLikes: likeEvents.length,
    timeline
  };
}

async function getMostActiveParticipants(limit = 10) {
  const { likes, participants } = await ensureCollections();

  const rows = await likes.aggregate([
    {
      $group: {
        _id: '$participantId',
        likes: { $sum: 1 }
      }
    },
    {
      $sort: {
        likes: -1,
        _id: 1
      }
    },
    {
      $limit: Math.max(1, Number(limit) || 10)
    }
  ]).toArray();

  if (!rows.length) {
    return [];
  }

  const ids = rows.map((row) => row._id);
  const people = await participants
    .find({ id: { $in: ids } }, { projection: { _id: 0, id: 1, name: 1 } })
    .toArray();

  const byId = new Map(people.map((person) => [person.id, person]));

  return rows.map((row) => {
    const person = byId.get(row._id);
    return {
      participantId: row._id,
      name: person?.name || 'Unknown participant',
      likes: row.likes
    };
  });
}

async function getState() {
  const participants = await listParticipants();
  const likes = await getLikesTimeline();

  return {
    count: participants.length,
    presentationStartedAt: likes.startedAt,
    totalLikes: likes.totalLikes,
    updatedAt: now()
  };
}

async function resetRaffle() {
  const { participants, likes, meta } = await ensureCollections();

  await participants.deleteMany({});
  await likes.deleteMany({});
  await meta.deleteOne({ _id: 'presentation' });
}

module.exports = {
  addEntry,
  getParticipantById,
  getMostActiveParticipants,
  getLikesTimeline,
  getState,
  listParticipants,
  recordLikeHit,
  resetRaffle,
  startPresentation
};
