const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// JSON file storage helpers
const db = require('./backend/config/database');
const Auth = require('./backend/config/auth');
const AuthDB = require('./backend/config/authDB');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// Socket.IO session middleware
io.use((socket, next) => {
  console.log('🔌 Socket.IO connection attempt:', {
    hasHandshake: !!socket.handshake,
    hasSession: !!socket.handshake?.session,
    sessionId: socket.handshake?.session?.id,
    headers: socket.handshake?.headers
  });

  sessionMiddleware(socket.request, socket.request.res || {}, (err) => {
    if (err) {
      console.log('❌ Socket session error:', err);
      return next(err);
    }

    console.log('✅ Socket session established:', {
      sessionId: socket.request.session?.id,
      hasUserId: !!socket.request.session?.userId,
      userId: socket.request.session?.userId,
      userEmail: socket.request.session?.userEmail
    });

    next();
  });
});

app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration with fallback
let sessionStore;
try {
  // Try to use MongoDB store for persistent sessions
  sessionStore = MongoStore.create({
    mongoUrl: 'mongodb://localhost:27017/chatapp_sessions',
    ttl: 365 * 24 * 60 * 60 // 1 year
  });
  console.log('✅ Using MongoDB session store for persistent authentication');
} catch (error) {
  console.log('⚠️ MongoDB not available, using MemoryStore (sessions will be lost on restart)');
  sessionStore = new session.MemoryStore();
}

const sessionMiddleware = session({
  store: sessionStore,
  secret: 'your-super-secret-key-change-this-in-production-123456789',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to false for HTTP (development), true for HTTPS (production)
    httpOnly: true, // Prevent XSS attacks
    sameSite: 'lax', // CSRF protection
    maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
  }
});

app.use(sessionMiddleware);

// Serve static client
app.use(express.static(path.join(__dirname, 'public')));

// Home route - serve main chat interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Private chat route
app.get('/private', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'private.html'));
});

// Group chat route
app.get('/group', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'group.html'));
});

// Groups display route
app.get('/groups', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'groups.html'));
});

// Add Friends route - serve with dynamic user data
app.get('/addFriends', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');

    const filePath = path.join(__dirname, 'public', 'addFriends.html');
    let html = await fs.readFile(filePath, 'utf8');

    // If user is authenticated, get their data
    if (req.session && req.session.userId) {
      const authData = await AuthDB.readAuthData();
      const currentUser = authData.users.find(u => u.userId === req.session.userId);

      if (currentUser) {
        // Replace placeholders with actual user data
        html = html.replace('let userName = null;', `let userName = '${currentUser.userName}';`);
        html = html.replace('let currentUser = null;', `let currentUser = '${currentUser.userEmail}';`);
        console.log('✅ AddFriends page: User authenticated as', currentUser.userName);
      } else {
        console.log('⚠️ AddFriends page: User not found in authData');
      }
    } else {
      console.log('⚠️ AddFriends page: User not authenticated');
    }

    res.send(html);
  } catch (error) {
    console.error('Error serving addFriends page:', error);
    res.status(500).send('Error loading page');
  }
});

// Login route
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Notifications route
app.get('/notification', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'notification.html'));
});

// Test endpoint for debugging
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Server is responding correctly',
    timestamp: new Date().toISOString()
  });
});

// Get all users for addFriends page (public endpoint, excludes sensitive data)
app.get('/api/users/addFriends', async (req, res) => {
  try {
    const authData = await AuthDB.readAuthData();

    // Get current user if authenticated
    const currentUserEmail = req.session?.userEmail;
    const currentUserData = currentUserEmail ? authData.users.find(u => u.userEmail === currentUserEmail) : null;

    const usersWithFriendshipStatus = authData.users.map(user => {
      if (!currentUserData || user.userEmail === currentUserEmail) {
        // Exclude current user or if no current user, just return basic info
        return {
          userId: user.userId,
          userName: user.userName,
          userEmail: user.userEmail
        };
      }

      // Check friendship status
      const isFriend = currentUserData.friends?.some(f => f.friendEmail === user.userEmail);
      const hasSentRequest = currentUserData.sentRequests?.includes(user.userEmail);
      const hasReceivedRequest = currentUserData.receivedRequests?.includes(user.userEmail);

      let friendshipStatus = 'none'; // none, friend, sent, received

      if (isFriend) {
        friendshipStatus = 'friend';
      } else if (hasSentRequest) {
        friendshipStatus = 'sent';
      } else if (hasReceivedRequest) {
        friendshipStatus = 'received';
      }

      return {
        userId: user.userId,
        userName: user.userName,
        userEmail: user.userEmail,
        friendshipStatus: friendshipStatus
      };
    });

    res.json({
      success: true,
      data: {
        users: usersWithFriendshipStatus
      },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: 'Failed to read authentication data',
      details: e.message
    });
  }
});

// Get friends for private chat
app.get('/api/auth/friends', requireAuth, async (req, res) => {
  try {
    const currentUser = req.session.userName;
    
    const data = await db.readData();

    const friends = data.friends?.[currentUser] || [];
    const allUsers = await Auth.getAllUsers();

    // Filter users to only include friends
    const friendUsers = allUsers.filter(user =>
      friends.includes(user.userName) && user.userName !== currentUser
    );

    // Add online status and friend relationship
    const friendsWithStatus = friendUsers.map(user => ({
      ...user,
      online: Math.random() > 0.3, // Simulate online status
      isFriend: true
    }));

    res.json({ users: friendsWithStatus });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Groups API endpoints
app.get('/api/groups', async (req, res) => {
  try {
    const data = await db.readData();
    res.json({ groups: data.groups || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/groups', requireAuth, async (req, res) => {
  try {
    const { groupName, groupDescription, needRequest } = req.body;
    const currentUser = req.session.userName;

    if (!groupName || !currentUser) {
      return res.status(400).json({ error: 'Group name and user required' });
    }

    const data = await db.readData();

    // Initialize groups if not exists
    if (!data.groups) data.groups = [];

    // Check if group already exists
    if (data.groups.some(g => g.groupName === groupName)) {
      return res.status(400).json({ error: 'Group already exists' });
    }

    // Create new group
    const newGroup = {
      groupName,
      groupDescription: groupDescription || 'New group created',
      needRequest: needRequest !== undefined ? needRequest : false,
      creator: currentUser,
      admins: [currentUser],
      members: [currentUser]
    };

    data.groups.push(newGroup);
    await db.writeData(data);

    res.json({ success: true, group: newGroup });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Group requests API endpoints
app.get('/api/group/requests', requireAuth, async (req, res) => {
  try {
    const currentUser = req.session.userName;
    const data = await db.readData();

    const requests = [];

    // Find all groups where current user is admin and there are pending requests
    if (data.groups) {
      data.groups.forEach(group => {
        if (group.admins && group.admins.includes(currentUser) && group.requests) {
          group.requests.forEach(userEmail => {
            requests.push({
              groupName: group.groupName,
              userEmail: userEmail,
              timestamp: Date.now() // You might want to store actual request timestamps
            });
          });
        }
      });
    }

    res.json({ requests });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/group/requests', requireAuth, async (req, res) => {
  try {
    const { groupName, userEmail, action } = req.body;
    const currentUser = req.session.userName;

    if (!groupName || !userEmail || !action) {
      return res.status(400).json({ error: 'Group name, user email, and action required' });
    }

    const data = await db.readData();
    const group = data.groups?.find(g => g.groupName === groupName);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if current user is admin of the group
    if (!group.admins || !group.admins.includes(currentUser)) {
      return res.status(403).json({ error: 'Only group admins can manage requests' });
    }

    if (!group.requests || !group.requests.includes(userEmail)) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (action === 'accept') {
      // Add user to group members
      if (!group.members.includes(userEmail)) {
        group.members.push(userEmail);
      }

      // Update user's group status in authData
      const authData = await AuthDB.readAuthData();
      const user = authData.users.find(u => u.userName === userEmail);
      if (user) {
        if (!user.groups) user.groups = [];
        let userGroup = user.groups.find(g => g.groupName === groupName);
        if (userGroup) {
          userGroup.status = 'member';
          userGroup.roles = ['member'];
        }
      }
      await AuthDB.writeAuthData(authData);
} else if (action === 'reject') {
      // Update user's group status to rejected in authData
      const authData = await AuthDB.readAuthData();
      const user = authData.users.find(u => u.userName === userEmail);
      if (user) {
        if (!user.groups) user.groups = [];
        let userGroup = user.groups.find(g => g.groupName === groupName);
        if (userGroup) {
          userGroup.status = 'rejected';
        }
      }
      await AuthDB.writeAuthData(authData);
    }

    // Remove from requests list
    group.requests = group.requests.filter(email => email !== userEmail);
    await db.writeData(data);

    // Emit socket events
    io.to(groupName).emit('groupRequestHandled', { groupName, userEmail, action });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Authentication middleware
function requireAuth(req, res, next) {
  console.log('🔐 Auth Check:', {
    hasSession: !!req.session,
    hasUserId: !!req.session?.userId,
    sessionId: req.session?.userId,
    sessionEmail: req.session?.userEmail,
    sessionName: req.session?.userName,
    url: req.url,
    method: req.method
  });

  if (req.session && req.session.userId) {
    return next();
  } else {
    console.log('❌ Authentication failed - redirecting to login');
    return res.status(401).json({ error: 'Authentication required' });
  }
}

app.post('/api/friends/accept', requireAuth, async (req, res) => {
  try {
    const { targetUser } = req.body;
    const currentUser = req.session.userEmail;

    const authData = await AuthDB.readAuthData();

    // Find the friend request
    const currentUserData = authData.users.find(u => u.userEmail === currentUser);
    const targetUserData = authData.users.find(u => u.userEmail === targetUser);

    if (!currentUserData || !targetUserData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already friends
    const alreadyFriends = (currentUserData.friends?.some(f => f.friendEmail === targetUser)) ||
                          (targetUserData.friends?.some(f => f.friendEmail === currentUser));

    if (alreadyFriends) {
      return res.status(400).json({ error: 'Users are already friends' });
    }

    // Add to both users' friends lists in authData
    if (currentUserData) {
      if (!currentUserData.friends) currentUserData.friends = [];
      const existingFriend = currentUserData.friends.find(f => f.friendEmail === targetUser);
      if (!existingFriend) {
        currentUserData.friends.push({
          friendEmail: targetUser,
          requesterStatus: 'accepted',
          messages: []
        });
      }
    }

    if (targetUserData) {
      if (!targetUserData.friends) targetUserData.friends = [];
      const existingFriend = targetUserData.friends.find(f => f.friendEmail === currentUser);
      if (!existingFriend) {
        targetUserData.friends.push({
          friendEmail: currentUser,
          requesterStatus: 'received',
          messages: []
        });
      }
    }

    await AuthDB.writeAuthData(authData);

    // Emit socket events
    io.to(targetUser).emit('friendRequestAccepted', { from: currentUser, to: targetUser });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Friend Request API Endpoints
app.post('/api/friends/send-request', requireAuth, async (req, res) => {
  try {
    const { targetUser } = req.body;
    const currentUser = req.session.userEmail;

    if (!targetUser || !currentUser) {
      return res.status(400).json({ error: 'Target user and current user are required' });
    }

    const authData = await AuthDB.readAuthData();
    const currentUserData = authData.users.find(u => u.userEmail === currentUser);
    const targetUserData = authData.users.find(u => u.userEmail === targetUser);

    if (!currentUserData || !targetUserData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already friends
    const alreadyFriends = currentUserData.friends?.some(f => f.friendEmail === targetUser) ||
                          targetUserData.friends?.some(f => f.friendEmail === currentUser);

    if (alreadyFriends) {
      return res.status(400).json({ error: 'Users are already friends' });
    }

    // Check if request already sent
    const alreadyRequested = currentUserData.sentRequests?.includes(targetUser) ||
                           targetUserData.receivedRequests?.includes(currentUser);

    if (alreadyRequested) {
      return res.status(400).json({ error: 'Friend request already sent' });
    }

    // Add to sentRequests for current user
    if (!currentUserData.sentRequests) currentUserData.sentRequests = [];
    currentUserData.sentRequests.push(targetUser);

    // Add to receivedRequests for target user
    if (!targetUserData.receivedRequests) targetUserData.receivedRequests = [];
    targetUserData.receivedRequests.push(currentUser);

    await AuthDB.writeAuthData(authData);

    // Emit socket event to notify target user
    io.to(targetUser).emit('friendRequest', {
      from: currentUser,
      to: targetUser,
      timestamp: Date.now()
    });

    res.json({ success: true, message: 'Friend request sent successfully' });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/friends/cancel-request', requireAuth, async (req, res) => {
  try {
    const { targetUser } = req.body;
    const currentUser = req.session.userEmail;

    if (!targetUser || !currentUser) {
      return res.status(400).json({ error: 'Target user and current user are required' });
    }

    const authData = await AuthDB.readAuthData();
    const currentUserData = authData.users.find(u => u.userEmail === currentUser);
    const targetUserData = authData.users.find(u => u.userEmail === targetUser);

    if (!currentUserData || !targetUserData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove from sentRequests for current user
    if (currentUserData.sentRequests) {
      currentUserData.sentRequests = currentUserData.sentRequests.filter(email => email !== targetUser);
    }

    // Remove from receivedRequests for target user
    if (targetUserData.receivedRequests) {
      targetUserData.receivedRequests = targetUserData.receivedRequests.filter(email => email !== currentUser);
    }

    await AuthDB.writeAuthData(authData);

    res.json({ success: true, message: 'Friend request canceled' });
  } catch (error) {
    console.error('Error canceling friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/friends/accept-request', requireAuth, async (req, res) => {
  try {
    const { targetUser } = req.body;
    const currentUser = req.session.userEmail;

    if (!targetUser || !currentUser) {
      return res.status(400).json({ error: 'Target user and current user are required' });
    }

    const authData = await AuthDB.readAuthData();
    const currentUserData = authData.users.find(u => u.userEmail === currentUser);
    const targetUserData = authData.users.find(u => u.userEmail === targetUser);

    if (!currentUserData || !targetUserData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add to friends for both users
    const addFriendToUser = (userData, friendEmail, status) => {
      if (!userData.friends) userData.friends = [];
      const existingFriend = userData.friends.find(f => f.friendEmail === friendEmail);
      if (!existingFriend) {
        userData.friends.push({
          friendEmail,
          requesterStatus: status,
          messages: []
        });
      }
    };

    addFriendToUser(currentUserData, targetUser, 'accepted');
    addFriendToUser(targetUserData, currentUser, 'received');

    // Remove from request arrays
    currentUserData.receivedRequests = currentUserData.receivedRequests?.filter(email => email !== targetUser) || [];
    targetUserData.sentRequests = targetUserData.sentRequests?.filter(email => email !== currentUser) || [];

    // Store notification for the original sender
    const notification = {
      id: `accepted_${Date.now()}`,
      type: 'friend_accepted_by',
      title: 'Friend Request Accepted',
      message: `${currentUser} accepted your friend request`,
      from: currentUser,
      timestamp: Date.now(),
      read: false
    };

    // Add notification to target user's notifications
    if (!targetUserData.notifications) targetUserData.notifications = [];
    targetUserData.notifications.unshift(notification);

    await AuthDB.writeAuthData(authData);

    // Emit socket events
    io.to(targetUser).emit('friendRequestAccepted', {
      from: currentUser,
      to: targetUser,
      timestamp: Date.now()
    });

    // Also notify the original sender that their request was accepted
    io.to(targetUser).emit('friendRequestAcceptedBy', {
      from: currentUser,
      to: targetUser,
      timestamp: Date.now()
    });

    res.json({ success: true, message: 'Friend request accepted' });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/friends/reject-request', requireAuth, async (req, res) => {
  try {
    const { targetUser } = req.body;
    const currentUser = req.session.userEmail;

    if (!targetUser || !currentUser) {
      return res.status(400).json({ error: 'Target user and current user are required' });
    }

    const authData = await AuthDB.readAuthData();
    const currentUserData = authData.users.find(u => u.userEmail === currentUser);
    const targetUserData = authData.users.find(u => u.userEmail === targetUser);

    if (!currentUserData || !targetUserData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove from request arrays
    currentUserData.receivedRequests = currentUserData.receivedRequests?.filter(email => email !== targetUser) || [];
    targetUserData.sentRequests = targetUserData.sentRequests?.filter(email => email !== currentUser) || [];

    // Store notification for the original sender
    const notification = {
      id: `rejected_${Date.now()}`,
      type: 'friend_rejected_by',
      title: 'Friend Request Rejected',
      message: `${currentUser} rejected your friend request`,
      from: currentUser,
      timestamp: Date.now(),
      read: false
    };

    // Add notification to target user's notifications
    if (!targetUserData.notifications) targetUserData.notifications = [];
    targetUserData.notifications.unshift(notification);

    await AuthDB.writeAuthData(authData);

    // Emit socket events
    io.to(targetUser).emit('friendRequestRejected', {
      from: currentUser,
      to: targetUser,
      timestamp: Date.now()
    });

    // Also notify the original sender that their request was rejected
    io.to(targetUser).emit('friendRequestRejectedBy', {
      from: currentUser,
      to: targetUser,
      timestamp: Date.now()
    });

    res.json({ success: true, message: 'Friend request rejected' });
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/friends/cleanup', requireAuth, async (req, res) => {
  try {
    const authData = await AuthDB.readAuthData();

    // Clean up any friends entries that use usernames instead of emails
    authData.users.forEach(user => {
      if (user.friends) {
        user.friends = user.friends.filter(friend => {
          // If friendEmail looks like an email (contains @), keep it
          if (friend.friendEmail && friend.friendEmail.includes('@')) {
            return true;
          }
          // If it doesn't contain @, it's probably a username - remove it
          console.log(`🧹 Removing invalid friend entry for ${user.userEmail}: ${friend.friendEmail}`);
          return false;
        });
      }
    });

    await AuthDB.writeAuthData(authData);
    res.json({ success: true, message: 'Friend entries cleaned up' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/friends', requireAuth, async (req, res) => {
  try {
    const currentUser = req.session.userEmail;

    const authData = await AuthDB.readAuthData();
    const currentUserData = authData.users.find(u => u.userEmail === currentUser);

    const friends = currentUserData?.friends || [];

    // Get detailed user info for each friend
    const friendsWithDetails = friends.map(friend => {
      const user = authData.users.find(u => u.userEmail === friend.friendEmail);
      return {
        ...friend,
        userName: user?.userName,
        userEmail: user?.userEmail,
        userId: user?.userId
      };
    });

    res.json({ friends: friendsWithDetails });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Notification API Endpoints
app.get('/api/friends/requests', requireAuth, async (req, res) => {
  try {
    const currentUser = req.session.userEmail;
    const authData = await AuthDB.readAuthData();
    const currentUserData = authData.users.find(u => u.userEmail === currentUser);

    if (!currentUserData) {
      return res.status(404).json({ error: 'User not found' });
    }

    const requests = [];

    // Add sent requests
    if (currentUserData.sentRequests) {
      currentUserData.sentRequests.forEach(targetEmail => {
        requests.push({
          type: 'sent',
          from: currentUser,
          to: targetEmail,
          timestamp: Date.now()
        });
      });
    }

    // Add received requests
    if (currentUserData.receivedRequests) {
      currentUserData.receivedRequests.forEach(fromEmail => {
        requests.push({
          type: 'received',
          from: fromEmail,
          to: currentUser,
          timestamp: Date.now()
        });
      });
    }

    res.json({ requests });
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const currentUser = req.session.userEmail;
    const authData = await AuthDB.readAuthData();
    const currentUserData = authData.users.find(u => u.userEmail === currentUser);

    if (!currentUserData) {
      return res.status(404).json({ error: 'User not found' });
    }

    const notifications = [];

    // Add stored notifications from authData
    if (currentUserData.notifications) {
      notifications.push(...currentUserData.notifications);
    }

    // Add received friend requests as notifications
    if (currentUserData.receivedRequests) {
      currentUserData.receivedRequests.forEach(fromEmail => {
        notifications.push({
          id: `friend_req_${fromEmail}_${Date.now()}`,
          type: 'friend_request',
          title: 'Friend Request',
          message: `${fromEmail} sent you a friend request`,
          from: fromEmail,
          timestamp: Date.now(),
          read: false
        });
      });
    }

    // Add sent friend requests as notifications
    if (currentUserData.sentRequests) {
      currentUserData.sentRequests.forEach(toEmail => {
        notifications.push({
          id: `sent_req_${toEmail}_${Date.now()}`,
          type: 'friend_request_sent',
          title: 'Friend Request Sent',
          message: `You sent a friend request to ${toEmail}`,
          to: toEmail,
          timestamp: Date.now(),
          read: true
        });
      });
    }

    // Sort notifications by timestamp (newest first)
    notifications.sort((a, b) => b.timestamp - a.timestamp);

    res.json({ notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/notifications/delete', requireAuth, async (req, res) => {
  try {
    const { notificationId } = req.body;
    const currentUser = req.session.userEmail;

    if (!notificationId || !currentUser) {
      return res.status(400).json({ error: 'Notification ID and current user are required' });
    }

    const authData = await AuthDB.readAuthData();
    const currentUserData = authData.users.find(u => u.userEmail === currentUser);

    if (!currentUserData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove the notification from user's notifications array
    if (currentUserData.notifications) {
      const initialLength = currentUserData.notifications.length;
      currentUserData.notifications = currentUserData.notifications.filter(n => n.id !== notificationId);

      if (currentUserData.notifications.length < initialLength) {
        await AuthDB.writeAuthData(authData);
        res.json({ success: true, message: 'Notification deleted successfully' });
      } else {
        res.status(404).json({ error: 'Notification not found' });
      }
    } else {
      res.status(404).json({ error: 'No notifications found for user' });
    }
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Authentication routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { userName, userPassword, userEmail } = req.body;

    if (!userName || !userPassword || !userEmail) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    if (userPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Call registerUser with correct parameter order: (name, email, password)
    const user = await Auth.registerUser(userName, userEmail, userPassword);
    req.session.userId = user.userId;
    req.session.userName = user.userName;
    req.session.userEmail = user.userEmail;

    res.json({
      success: true,
      user: {
        userId: user.userId,
        userName: user.userName,
        userEmail: user.userEmail,
        friends: user.friends || [],
        groups: user.groups || []
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { userName, userPassword } = req.body;

    if (!userName || !userPassword) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Frontend sends userName as email, userPassword as password
    // Backend authenticateUser expects (email, password)
    const user = await Auth.authenticateUser(userName, userPassword);
    const fullUser = await Auth.getUserById(user.userId);

    req.session.userId = user.userId;
    req.session.userName = user.userName;
    req.session.userEmail = fullUser.userEmail;

    res.json({
      success: true,
      user: {
        userId: user.userId,
        userName: user.userName,
        userEmail: fullUser.userEmail
      }
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.json({ success: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  console.log('🔍 /api/auth/me called:', {
    hasSession: !!req.session,
    hasUserId: !!req.session?.userId,
    sessionId: req.session?.userId,
    sessionEmail: req.session?.userEmail,
    sessionName: req.session?.userName,
    cookies: req.headers.cookie
  });

  if (req.session && req.session.userId) {
    console.log('✅ /api/auth/me: User authenticated, returning user data');
    res.json({
      userId: req.session.userId,
      userName: req.session.userName,
      userEmail: req.session.userEmail
    });
  } else {
    console.log('❌ /api/auth/me: User not authenticated');
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Data API routes
app.get('/api/authdata', requireAuth, async (req, res) => {
  try {
    const authData = await AuthDB.readAuthData();
    res.json({
      success: true,
      data: authData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reading authData:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read authentication data',
      details: error.message
    });
  }
});

app.get('/api/data', requireAuth, async (req, res) => {
  try {
    const data = await db.readData();
    res.json({
      success: true,
      data: data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reading data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read application data',
      details: error.message
    });
  }
});

// Function to update user's online status in authData
async function updateUserOnlineStatus(userEmail, isOnline) {
  try {
    const authData = await AuthDB.readAuthData();

    // Find the user
    const userData = authData.users.find(u => u.userEmail === userEmail);
    if (userData) {
      // Update user's own online status
      userData.online = isOnline;

      // Update user's online status in all friends' friend lists
      authData.users.forEach(u => {
        if (u.friends) {
          const friendData = u.friends.find(f => f.friendEmail === userEmail);
          if (friendData) {
            friendData.online = isOnline;
          }
        }
      });

      await AuthDB.writeAuthData(authData);
      console.log(`✅ Updated ${userEmail} online status to ${isOnline}`);
    }
  } catch (error) {
    console.error('Error updating user online status:', error);
  }
}

io.on('connection', (socket) => {
  let currentRoom = null;
  let userName = null;

  socket.on('join', async ({ room, user }) => {
    try {
      const data = await db.readData();

      // Get authenticated user from session if available
      if (socket.request.session && socket.request.session.userId) {
        const authUser = await Auth.getUserById(socket.request.session.userId);
        if (authUser) {
          userName = authUser.userName;
        } else {
          userName = user || `Guest-${socket.id.slice(0, 4)}`;
        }
      } else {
        userName = user || `Guest-${socket.id.slice(0, 4)}`;
      }

      currentRoom = room && data.rooms.includes(room) ? room : 'general';

      socket.join(currentRoom);

      // Send recent messages to the joining user
      const history = data.messages[currentRoom] || [];
      socket.emit('history', history);

      const joinMsg = { system: true, text: `${userName} joined ${currentRoom}`, ts: Date.now() };
      io.to(currentRoom).emit('system', joinMsg);
    } catch (error) {
      console.error('Error in join event:', error);
    }
  });

  socket.on('message', async (text) => {
    if (!text) return;
    try {
      const data = await db.readData();
      const authData = await AuthDB.readAuthData();
      const currentUser = socket.request.session?.userEmail;

      if (!currentUser || !currentRoom) return;

      // Find the group
      const group = data.groups?.find(g => g.groupName === currentRoom);
      if (!group) return;

      // Check if user is member of the group
      if (!group.members.includes(currentUser)) {
        socket.emit('error', { message: 'You are not a member of this group' });
        return;
      }

      const message = {
        text,
        sender: currentUser,
        status: 'sent',
        timestamp: new Date().toISOString()
      };

      // Add message to all group members' auth data
      for (const member of group.members) {
        const user = authData.users.find(u => u.userEmail === member);
        if (user) {
          if (!user.groups) user.groups = [];
          let userGroup = user.groups.find(g => g.groupName === currentRoom);

          if (!userGroup) {
            userGroup = {
              groupName: currentRoom,
              status: 'member',
              roles: ['member'],
              messages: []
            };
            user.groups.push(userGroup);
          }

          if (!userGroup.messages) userGroup.messages = [];
          userGroup.messages.push(message);
        }
      }

      await AuthDB.writeAuthData(authData);

      // Send to all group members
      io.to(currentRoom).emit('message', message);
    } catch (error) {
      console.error('Error in message event:', error);
    }
  });

  socket.on('switchGroup', async (newGroup) => {
    try {
      const data = await db.readData();
      const group = data.groups?.find(g => g.groupName === newGroup);

      if (!group) return; // ignore unknown groups

      if (currentRoom) socket.leave(currentRoom);
      currentRoom = newGroup;
      socket.join(currentRoom);

      // Get group messages from authData
      const authData = await AuthDB.readAuthData();
      const currentUser = socket.request.session?.userEmail;

      let groupMessages = [];
      if (currentUser) {
        const user = authData.users.find(u => u.userEmail === currentUser);
        const userGroup = user?.groups?.find(g => g.groupName === newGroup);
        groupMessages = userGroup?.messages || [];
      }

      socket.emit('history', groupMessages);
    } catch (error) {
      console.error('Error in switchGroup event:', error);
    }
  });

  socket.on('joinGroup', async (groupName) => {
    try {
      const data = await db.readData();
      const authData = await AuthDB.readAuthData();
      const currentUser = socket.request.session?.userEmail;

      if (!currentUser || !groupName) return;

      const group = data.groups?.find(g => g.groupName === groupName);
      if (!group) return;

      // Check if user is member or can join
      if (!group.members.includes(currentUser) && group.needRequest) {
        // Add to requests if group requires approval
        if (!group.requests) group.requests = [];
        if (!group.requests.includes(currentUser)) {
          group.requests.push(currentUser);
          await db.writeData(data);

          // Emit notification to group admins
          io.to(groupName).emit('groupRequest', {
            groupName,
            userEmail: currentUser,
            timestamp: Date.now()
          });
        }
        socket.emit('joinRequestSent', groupName);
        return;
      }

      // Add user to group if not already member
      if (!group.members.includes(currentUser)) {
        group.members.push(currentUser);
        await db.writeData(data);
      } 

      socket.join(groupName);
      socket.emit('joinedGroup', groupName);

      // Send group messages
      const user = authData.users.find(u => u.userEmail === currentUser);
      const userGroup = user?.groups?.find(g => g.groupName === groupName);
      const messages = userGroup?.messages || [];

      socket.emit('history', messages);
    } catch (error) {
      console.error('Error in joinGroup event:', error);
    }
  });

  socket.on('leave', (room) => {
    socket.leave(room);
    if (currentRoom === room) {
      currentRoom = null;
      socket.emit('roomLeft', room);
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom && userName) {
      const leaveMsg = { system: true, text: `${userName} left ${currentRoom}`, ts: Date.now() };
      io.to(currentRoom).emit('system', leaveMsg);
    }
    // Emit user offline status to all private chat participants
    if (userName) {
      socket.broadcast.emit('userOffline', userName);
      updateUserOnlineStatus(userName, false);
    }
  });

  socket.on('userConnected', (user) => {
    userName = user;
    socket.broadcast.emit('userOnline', user);

    // Update user's online status in authData
    updateUserOnlineStatus(user, true);
  });

  // Private chat events
  socket.on('joinPrivate', async (targetUser) => {
    try {
      // Get user information from socket session
      const currentUser = socket.request.session?.userEmail;
      if (!currentUser) {
        console.error('❌ No authenticated user in socket session for joinPrivate');
        return;
      }

      const privateRoom = [currentUser, targetUser].sort().join('-');
      console.log(`🔗 User ${currentUser} joined private room: ${privateRoom}`);

      socket.join(privateRoom);

      // Load private message history from authData
      const authData = await AuthDB.readAuthData();
      const currentUserData = authData.users.find(u => u.userEmail === currentUser);

      if (currentUserData && currentUserData.friends) {
        const friendData = currentUserData.friends.find(f => f.friendEmail === targetUser);
        const messages = friendData?.messages || [];
        console.log(`📚 Loaded ${messages.length} messages for ${currentUser} with ${targetUser}`);

        if (messages.length > 0) {
          socket.emit('privateHistory', messages);
          console.log(`📤 Sent message history to ${currentUser}`);
        }
      }
    } catch (error) {
      console.error('❌ Error in joinPrivate event:', error);
    }
  });

  socket.on('privateMessage', async (data) => {
    try {
      const { to, text } = data;
      const privateRoom = [userName, to].sort().join('-');

      console.log(`📨 Private message from ${userName} to ${to}: "${text}"`);

      // Get user information from socket session
      const currentUser = socket.request.session?.userEmail;
      if (!currentUser) {
        console.error('❌ No authenticated user in socket session');
        return;
      }

      // Store private message in authData for both users
      const authData = await AuthDB.readAuthData();
      console.log(`📂 Loaded authData with ${authData.users.length} users`);

      // Find both users
      const senderData = authData.users.find(u => u.userEmail === currentUser);
      const receiverData = authData.users.find(u => u.userEmail === to);

      if (!senderData) {
        console.error(`❌ Sender not found: ${currentUser}`);
        return;
      }
      if (!receiverData) {
        console.error(`❌ Receiver not found: ${to}`);
        return;
      }

      console.log(`✅ Found sender: ${senderData.userName} (${senderData.userEmail})`);
      console.log(`✅ Found receiver: ${receiverData.userName} (${receiverData.userEmail})`);

      const timestamp = new Date().toISOString();
      const message = {
        text,
        sender: currentUser,
        status: 'sent',
        timestamp
      };

      console.log(`📝 Creating message: ${JSON.stringify(message)}`);

      // Add message to sender's friend data
      if (!senderData.friends) {
        senderData.friends = [];
        console.log(`🆕 Created friends array for sender`);
      }

      let senderFriend = senderData.friends.find(f => f.friendEmail === to);
      if (!senderFriend) {
        // Create friend entry if it doesn't exist
        senderFriend = {
          friendEmail: to,
          requesterStatus: 'accepted',
          messages: []
        };
        senderData.friends.push(senderFriend);
        console.log(`✅ Created new friend entry: ${currentUser} -> ${to}`);
      }
 
      if (!senderFriend.messages) {
        senderFriend.messages = [];
        console.log(`🆕 Created messages array for sender's friend`);
      }

      senderFriend.messages.push(message);
      console.log(`✅ Added message to sender's friend data. Total: ${senderFriend.messages.length}`);

      // Add message to receiver's friend data
      if (!receiverData.friends) {
        receiverData.friends = [];
        console.log(`🆕 Created friends array for receiver`);
      }

      let receiverFriend = receiverData.friends.find(f => f.friendEmail === currentUser);
      if (!receiverFriend) {
        // Create friend entry if it doesn't exist
        receiverFriend = {
          friendEmail: currentUser,
          requesterStatus: 'accepted',
          messages: []
        };
        receiverData.friends.push(receiverFriend);
        console.log(`✅ Created new friend entry: ${to} -> ${currentUser}`);
      }

      if (!receiverFriend.messages) {
        receiverFriend.messages = [];
        console.log(`🆕 Created messages array for receiver's friend`);
      }

      const receivedMessage = {
        text,
        sender: currentUser,
        status: 'received',
        timestamp
      };
      receiverFriend.messages.push(receivedMessage);
      console.log(`✅ Added message to receiver's friend data. Total: ${receiverFriend.messages.length}`);

      // Write updated data to file
      await AuthDB.writeAuthData(authData);
      console.log(`💾 Successfully saved messages to authData.json`);

      // Verify the save by reading it back
      const verifyData = await AuthDB.readAuthData();
      const verifySender = verifyData.users.find(u => u.userEmail === currentUser);
      const verifyReceiver = verifyData.users.find(u => u.userEmail === to);

      if (verifySender && verifyReceiver) {
        const verifySenderFriend = verifySender.friends?.find(f => f.friendEmail === to);
        const verifyReceiverFriend = verifyReceiver.friends?.find(f => f.friendEmail === currentUser);

        console.log(`🔍 Verification - Sender messages: ${verifySenderFriend?.messages?.length || 0}`);
        console.log(`🔍 Verification - Receiver messages: ${verifyReceiverFriend?.messages?.length || 0}`);
      }

      // Send to recipient if online
      socket.to(privateRoom).emit('privateMessage', message);
      console.log(`📤 Sent message to recipient via socket`);
    } catch (error) {
      console.error('❌ Error in privateMessage event:', error);
    }
  });

  socket.on('typing', (data) => {
    const { to, typing } = data;
    
    // Get user information from socket session
    const currentUser = socket.request.session?.userEmail;
    if (!currentUser) {
      console.error('❌ No authenticated user in socket session for typing');
      return;
    }

    const privateRoom = [currentUser, to].sort().join('-');
    socket.to(privateRoom).emit('typing', { from: currentUser, typing });
  });
});

// Function to update user's online status in authData
async function updateUserOnlineStatus(userEmail, isOnline) {
  try {
    const authData = await AuthDB.readAuthData();

    // Find the user
    const userData = authData.users.find(u => u.userEmail === userEmail);
    if (userData) {
      // Update user's own online status
      userData.online = isOnline;

      // Update user's online status in all friends' friend lists
      authData.users.forEach(u => {
        if (u.friends) {
          const friendData = u.friends.find(f => f.friendEmail === userEmail);
          if (friendData) {
            friendData.online = isOnline;
          }
        }
      });

      await AuthDB.writeAuthData(authData);
      console.log(`✅ Updated ${userEmail} online status to ${isOnline}`);
    }
  } catch (error) {
    console.error('Error updating user online status:', error);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});
