require('dotenv').config();
const {MongoClient} = require('mongodb');

const mongo = new MongoClient(process.env.LOCAL_DB);

module.exports = mongo;
