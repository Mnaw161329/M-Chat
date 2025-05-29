require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const port = process.env.PORT;
const cors = require('cors');
const path = require('path');
const userRoute = require('./api/user')

app.use(cors());
app.use(express.json());

app.use("/user", userRoute);

app.use("/", express.static(path.join(__dirname, 'public')));

app.get("/chat", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

io.on('connection', (socket) => {
    console.log('User connected!');
    
    socket.on('chat message', (data) => {
        io.emit('chat message', data);
        console.log(data)
    });
    
    socket.on('disconnect', () => {
        console.log('user disconnected!')
    });
});
    
http.listen(port, () => {
    console.log(`Server is running on "http://localhost:${port}"`);
});
