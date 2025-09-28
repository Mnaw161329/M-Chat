const bcrypt = require('bcrypt');
const AuthDB = require('./authDB');

class Auth {
  static async hashPassword(password) {
    return await bcrypt.hash(password, 12);
  }

  static async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  static async registerUser(name, email, password) {
    const data = await AuthDB.readAuthData();

    // Check if user already exists by email
    const existingUser = data.users.find(u => u.userEmail === email);
    if (existingUser) {
      throw new Error('Email already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create new user
    const newUser = {
      userId: Date.now().toString(),
      userPassword: hashedPassword,
      userName: name,
      userEmail: email,
      createdAt: new Date().toISOString(),
      friends: [], // Initialize empty friends array
      groups: []   // Initialize empty groups array
    };

    data.users.push(newUser);
    await AuthDB.writeAuthData(data);

    return { userId: newUser.userId, userName: newUser.userName, userEmail: newUser.userEmail, friends: newUser.friends, groups: newUser.groups };
  }

  static async authenticateUser(email, password) {
    const data = await AuthDB.readAuthData();

    // Find user by email only
    const user = data.users.find(u => u.userEmail === email);

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await this.comparePassword(password, user.userPassword);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    return { userId: user.userId, userName: user.userName };
  }

  static async getUserById(id) {
    const data = await AuthDB.readAuthData();
    const user = data.users.find(u => u.userId === id);
    if (user) {
      return {
        userId: user.userId,
        userName: user.userName,
        userEmail: user.userEmail,
        friends: user.friends || [],
        groups: user.groups || []
      };
    }
    return null;
  }

  static async getAllUsers() {
    const data = await AuthDB.readAuthData();
    return data.users.map(u => ({
      userId: u.userId,
      userName: u.userName,
      userEmail: u.userEmail,
      friends: u.friends || [],
      groups: u.groups || []
    }));
  }

  static getAllUsersSync() {
    // Synchronous version for use in API endpoints
    try {
      const fs = require('fs');
      const path = require('path');
      const authDataPath = path.join(__dirname, '..', 'data', 'authData.json');

      if (fs.existsSync(authDataPath)) {
        const data = JSON.parse(fs.readFileSync(authDataPath, 'utf8'));
        return data.users.map(u => ({
          userId: u.userId,
          userName: u.userName,
          userEmail: u.userEmail,
          friends: u.friends || [],
          groups: u.groups || []
        }));
      }
      return [];
    } catch (error) {
      console.error('Error reading auth data synchronously:', error);
      return [];
    }
  }
}

module.exports = Auth;
