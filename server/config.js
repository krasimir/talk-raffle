const secrets = require('../secrets/config');

module.exports = {
  presenterPin: secrets.presenterPin,
  mongo: {
    uri: secrets.mongo.uri,
    dbName: secrets.mongo.dbName,
    collection: secrets.mongo.collection
  }
};