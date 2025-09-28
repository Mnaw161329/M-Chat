const fs = require('fs').promises;
const path = require('path');

// Absolute path to the JSON data file
const DATA_FILE = path.resolve(__dirname, '..', 'data', 'data.json');

/**
 * Read and parse the entire JSON file.
 * If the file does not exist, it will be created with an empty object.
 */
async function readData() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      await writeData({});
      return {};
    }
    throw err;
  }
}

/**
 * Write the entire data object back to the JSON file.
 */
async function writeData(data) {
  const json = JSON.stringify(data, null, 4) + '\n';
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, json, 'utf-8');
  return data;
}

/**
 * Get the whole data object, or a specific key within it.
 */
async function get(key) {
  const data = await readData();
  return typeof key === 'undefined' ? data : data[key];
}

/**
 * Set a specific key in the data object and persist it.
 */
async function set(key, value) {
  const data = await readData();
  data[key] = value;
  await writeData(data);
  return data[key];
}

module.exports = {
  DATA_FILE,
  readData,
  writeData,
  get,
  set,
};
