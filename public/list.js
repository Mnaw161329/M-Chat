const socket = io();

const urlParams = new URLSearchParams(window.location.search);
const id = urlParams.get('id');

let to = '';

document.addEventListener('DOMContentLoaded', () => {
    listFriends(id);
});

document.getElementById('add').addEventListener('click', async () => {
    try {
        const res = await fetch('/user/data');
        const data = await res.json();

        const message = document.getElementById('message');
        const getId = document.getElementById('getId');
        const toAdd = getId.value.trim();

        if (!toAdd) {
            alert("Enter friend's id to add friend");
        }
        else {
            if (toAdd === id) {
                alert("You can't add yourself!");
                getId.value = "";
            }
            else {
                let n = "";
    
                for (let i = 0; i < data.length; i++) {
                    if (data[i]._id === toAdd) {
                        n = i;
                        break;
                    }
                }

                if (data[n].user.data.friends.length === 0) {
                    addFriend(id, toAdd);
                    alert("Add friend success!");
                    getId.value = "";
                }
                else {
                    let isFriend = false;
                    for (let j = 0; j < data[n].user.data.friends.length; j++) {
                        if (data[n].user.data.friends[j].friendId === id) {
                            alert("Already friend!");
                            getId.value = "";
                            isFriend = true;
                            break;
                        }
                    }

                    if (!isFriend) {
                        addFriend(id, toAdd);
                        alert("Add friend success!");
                        getId.value = "";
                    }
                }
            }
        }
    }
    catch (err) {
        console.log(err);
    }
});

async function listFriends(id) {
    try {
        const res = await fetch('/user/info', {
            method: "POST",
            headers: {
                "Content-type": "application/json"
            },
            body: JSON.stringify({
                id: id,
            })
        });

        if (!res.ok) {
            throw new Error('Error: ' + res.status);
        }

        const data = await res.json();

        const friends = data.data.user.data.friends;
        const friendsCount = friends.length;

        if (friendsCount !== 0) displayFriends(friends, friendsCount);

        return data;
    }
    catch {}
}

async function displayFriends(friends, friendsCount) {
    const chatForm = document.getElementById('chatForm');
    const friendsList = document.getElementById('friendsList');
    const messagesList = document.getElementById('messagesList');
    const addFriend = document.getElementById('addFriend');

    try {
        const res = await fetch('/user/data');

        if (!res.ok) {
            throw new Error("Error: " + res.status);
        }

        const data = await res.json();

        const myIndex = data.findIndex(myIndex => myIndex._id === id);

        for (let i = 0; i < friendsCount; i++) {
            const friendId = friends[i].friendId;

            const find = data.find(item => item._id === friendId);

            const li = document.createElement('li');
            li.innerText = find.user.name;
            li.setAttribute('data-id', find._id);
            friendsList.appendChild(li);
        }

        friendsList.addEventListener('click', function(e) {
            const friId = e.target.dataset.id;
            to = friId;

            if (friId) {
                const friendIndex = data[myIndex].user.data.friends.findIndex(friendIndex => friendIndex.friendId === friId);

                const messages = data[myIndex].user.data.friends[friendIndex].messages;
                const messagesCount = data[myIndex].user.data.friends[friendIndex].messages.length;

                for( let i = 0; i < messagesCount; i++) {
                    const li = document.createElement('li');
                    li.innerText = messages[i].message;
                    messagesList.appendChild(li);

                    if (messages[i].status === "received") {
                        li.classList.add(messages[i].status);
                    }
                    else {
                        li.classList.add(messages[i].status);
                    }
                }

                friendsList.classList.add('hidden');
                chatForm.classList.remove('hidden');
                addFriend.classList.add('hidden');
            }
        });
    }
    catch (err) {
        alert(err);
    }
}

async function addFriend(id, friendId) {
    try {
        const res = await fetch('/user/addfriend', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                id: id,
                friendId: friendId, 
            })
        });

        displayFriends();
    }
    catch (err) {
        console.log(err)
    }
}


async function updateData(from, to, message) {
    try {
        await fetch('/user/updatedata', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            
            body: JSON.stringify({
                status: status,
                from: from,
                to: to,
                message: message,
            })
        });
    }
    catch (err) {
        alert(err);
    }
}

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    
    if (message) {
        socket.emit('chat message', {
            from: id,
            to: to,
            message: message
        });
    }
    messageInput.value = "";
});

socket.on('chat message', data => {

    if (data.from === id) {
        const li = document.createElement('li');
        li.textContent = data.message;
        messagesList.appendChild(li);

        li.classList.add('sent');
    }

    if (data.to === id) {
        const li = document.createElement('li');
        li.textContent = data.message;
        messagesList.appendChild(li);

        li.classList.add('received');
    }

    if (data) {
        updateData(id, data.to, data.message);
    }
});

