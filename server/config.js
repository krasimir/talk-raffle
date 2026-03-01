const path = require('node:path');
const fs = require('node:fs');

const localSecretsPath = path.join(__dirname, '..', 'secrets', 'config.js');
const hasLocalSecrets = fs.existsSync(localSecretsPath);
const localSecrets = hasLocalSecrets ? require(localSecretsPath) : null;

function pick(value, fallback) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return fallback;
}

const presenterPin = pick(process.env.PRESENTER_PIN, localSecrets?.presenterPin);
const mongoUri = pick(process.env.MONGO_URI, localSecrets?.mongo?.uri);
const mongoDbName = pick(process.env.MONGO_DB_NAME, localSecrets?.mongo?.dbName || 'raffle');
const mongoCollection = pick(process.env.MONGO_COLLECTION, localSecrets?.mongo?.collection || 'raffle_entries');

if (!presenterPin || !mongoUri) {
  throw new Error('Missing configuration. Set PRESENTER_PIN and MONGO_URI (or provide secrets/config.js).');
}

module.exports = {
  presenterPin,
  mongo: {
    uri: mongoUri,
    dbName: mongoDbName,
    collection: mongoCollection
  }
};