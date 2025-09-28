const fs = require('fs').promises;
const path = require('path');

const AUTH_DATA_PATH = path.join(__dirname, '../data/authData.json');

class AuthDB {
  static async readAuthData() {
    try {
      const data = await fs.readFile(AUTH_DATA_PATH, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // If file doesn't exist, create it with default structure
      if (error.code === 'ENOENT') {
        const defaultData = { users: [] };
        await this.writeAuthData(defaultData);
        return defaultData;
      }
      throw error;
    }
  }

  static async writeAuthData(data) {
    await fs.writeFile(AUTH_DATA_PATH, JSON.stringify(data, null, 2));
  }
}

module.exports = AuthDB;
