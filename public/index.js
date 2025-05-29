const id = {
    name: document.getElementById('userName'),
    email: document.getElementById('userEmail'),
    password: document.getElementById('userPassword'),
    checkbox: document.getElementById('visiblePassword'),
    signUp: document.getElementById('signUp'),
    signIn: document.getElementById('signIn'),
    signInOrUp: document.getElementById('signInOrUp'),
    friendsList: document.getElementById('friendsList'),
};

id.checkbox.addEventListener('change', () => {
    const type = id.password.getAttribute('type') === "password" ? "text" : "password";
    id.password.setAttribute('type', type);
});

id.signInOrUp.addEventListener('click', () => {
    if (!id.signUp.classList.contains('hidden')) {
        id.signUp.classList.add('hidden');
        id.signIn.classList.remove('hidden');
        id.name.classList.add('hidden');
    }
    else {
        id.signUp.classList.remove('hidden');
        id.signIn.classList.add('hidden');
        id.name.classList.remove('hidden');
    }
});
 
id.signUp.addEventListener('click', (e) => {
    e.preventDefault();
    const name = id.name.value.trim();
    const email = id.email.value.trim();
    const password = id.password.value.trim();
    signUp(name, email, password);
});

id.signIn.addEventListener('click', (e) => {
    e.preventDefault();
    const email = id.email.value.trim();
    const password = id.password.value.trim();
    signIn(email, password);
});

async function signUp(name, email, password){
    try{
        const res = await fetch('/user/signup', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                user: {
                    name: name,
                    email: email,
                    password: password,
                    data: {
                        friends: []
                    }
                }
            })
        });

        if (!res.ok) {
            throw new Error(`Error: ${res.status}`);
        }

        const data = await res.json();

        alert('Message: ' + data.message);

        if (data.status == "Success") cookie("id", data.received._id);

        return data;
    }
    catch (err) {
        console.log(err);
    }
}

async function signIn(email, password){
    try{
        const res = await fetch('/user/signin', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                user: {
                    email: email,
                    password: password
                }
            })
        });

        if (!res.ok) {
            throw new Error(`Error: ${res.status}`);
        }

        const data = await res.json();

        alert(data.message);

        if(data.status === "Success") cookie("id", data.received._id);
 
        return data;
    }
    catch (err) {
        console.log(err);
    }
}

function cookie(id, value) {

    setCookie(id, value, 15);

    function setCookie(id, value, time) {
        let expires = "";
        if (time) {
            const date = new Date();
            date.setTime(date.getTime() + (time * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }

        document.cookie = id + "=" + (value || "") + expires + "; path=/";
    }

    function getCookie(id) {
        const rememberedId = id + "=";
        const pieceOfCookie = document.cookie.split(";");

        for (let i = 0; i < pieceOfCookie.length; i++) {
            let currentCookie = pieceOfCookie[i].trim();

            if (currentCookie.indexOf(rememberedId) === 0) {
                return currentCookie.substring(rememberedId.length, currentCookie.length);
            }
        }
        return null;
    }
    
    function checkCookie(id) {
        const user = getCookie(id);
        if (user){
            window.location.href = `/chat?id=${user}`;
        }
    }

    checkCookie(id);
}

document.addEventListener('DOMContentLoaded', () => {
    function getCookie(id) {
        const rememberedId = id + "=";
        const pieceOfCookie = document.cookie.split(";");

        for (let i = 0; i < pieceOfCookie.length; i++) {
            let currentCookie = pieceOfCookie[i].trim();

            if (currentCookie.indexOf(rememberedId) === 0) {
                return currentCookie.substring(rememberedId.length, currentCookie.length)
            }
        }
        return null;
    }
    
    function checkCookie(id) {
        const user = getCookie(id);
        if (user){
            window.location.href = `/chat?id=${user}`;
        }
        else {
            alert('welcome!');
        }
    }

    checkCookie("id");
});
