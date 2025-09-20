require('dotenv').config();
const {MongoClient} = require('mongodb');

const mongo = new MongoClient(process.env.DB_URI);

module.exports = mongo;
