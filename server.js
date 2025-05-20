const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const DEFAULT_AVATAR = "https://static.vecteezy.com/system/resources/previews/026/619/142/original/default-avatar-profile-icon-of-social-media-user-photo-image-vector.jpg";

// Online users tracking
const onlineUsers = new Map();
const userPresence = new Map();

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('user-login', (userData) => {
        const userDataWithAvatar = {
            ...userData,
            photoURL: userData.photoURL || DEFAULT_AVATAR
        };
        
        userPresence.set(userData.userId, {
            status: 'online',
            lastActive: new Date(),
            displayName: userData.displayName, // Use real name from Google auth
            photoURL: userDataWithAvatar.photoURL
        });
        
        onlineUsers.set(userData.userId, {
            socketId: socket.id,
            userData: userDataWithAvatar
        });
        
        broadcastOnlineUsers();
    });

    socket.on('chat message', (data) => {
        // Send to recipient
        const recipientSocket = onlineUsers.get(data.recipientId)?.socketId;
        if (recipientSocket) {
            io.to(recipientSocket).emit('chat message', {
                ...data,
                type: 'incoming'
            });
        }
        // Send back to sender
        socket.emit('chat message', {
            ...data,
            type: 'outgoing'
        });
        
        // Send message status
        socket.emit('message-status', { 
            messageId: data.messageId, 
            status: recipientSocket ? 'sent' : 'pending'
        });
    });

    socket.on('disconnect', () => {
        handleDisconnect(socket.id);
    });
});

function handleDisconnect(socketId) {
    let disconnectedUserId;
    onlineUsers.forEach((value, key) => {
        if (value.socketId === socketId) {
            disconnectedUserId = key;
        }
    });
    
    if (disconnectedUserId) {
        userPresence.set(disconnectedUserId, {
            ...userPresence.get(disconnectedUserId),
            status: 'offline',
            lastActive: new Date()
        });
        onlineUsers.delete(disconnectedUserId);
        broadcastOnlineUsers();
    }
}

function broadcastOnlineUsers() {
    const usersList = Array.from(onlineUsers.entries()).map(([userId, data]) => ({
        userId,
        ...data.userData,
        presence: userPresence.get(userId)
    }));
    io.emit('online-users', usersList);
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
