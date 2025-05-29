const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const mongo = require('../config/db');
const { ObjectId } = require('mongodb');

mongo.connect().then(console.log("DB connected!"));
const database = mongo.db('testAPI');
const collection = database.collection('userdata');

router.use('/data', async (req, res) => {
    const data = await collection.find().toArray();
    res.json(data);
});

const toFind = `user.email`;

router.post('/signup', async (req, res) => {
    let data = req.body;

    const finder = await collection.find({[toFind]: data.user.email}).toArray();

    // console.log(finder[0]);

    if (data.user.name !== "" && data.user.email !== "" && data.user.password !== "" ){
        if (finder[0] === undefined) {
            const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (regex.test(data.user.email)) {
                if (data.user.password.length < 8) {
                    res.json({
                        status: "Failed",
                        message: "Your password is too short!"
                    });
                }
                else {
                    bcrypt.hash(data.user.password, 5).then(hashed => {
                        collection.insertOne(data).then(() => {
                            collection.updateOne({[toFind]: data.user.email}, {$set: {"user.password": hashed}})
                            .then(() => console.log("Done!"))
                            .then(
                                res.json({
                                status: "Success",
                                message: "SingUp successful",
                                received: finder[0]
                            }))
                            .catch(err => console.log(err));
                        });
                    });
                }
            }
            else {
                res.json({
                    status: "failed",
                    message: "Email invalid"
                });
            }
        }
        else {
            res.json({
                status: "Failed",
                message: "Your email is already exist"
            });
        }
    }
    else{
        res.json({
            status: "Failed",
            message: "You need to fill your infomation!"
        });
    }

});

router.post('/signin', async (req, res) => {
    let data = req.body;

    const finder = await collection.find({[toFind]: data.user.email}).toArray();

    if (data.user.email !== "" && data.user.password !== "" ){
        if (finder[0] !== undefined) {
            bcrypt.compare(data.user.password, finder[0].user.password).then(result => {
                if (result) {
                    res.json({
                        status: "Success",
                        message: `Welcome ${finder[0].user.name}!`,
                        received: finder[0],
                    });
                }
                else {
                    res.json({
                        status: "Failed",
                        message: "Incorrect password!"
                    });
                }
            });
        }
        else {
            res.json({
                status: "Failed",
                message: "User isn't found! Please register!"
            });
        }
    }
    else{
        res.json({
            status: "Failed",
            message: "You need to fill your infomation!"
        });
    }
});

router.post('/info', async (req, res) => {
    let data = req.body;

    const finder = await collection.find({_id: new ObjectId(`${data.id}`)}).toArray();

    res.json({
        data: finder[0],
    });
});

router.post('/addfriend', async (req, res) => {
    let data = req.body;

    const finder = await collection.find({_id: new ObjectId(`${data.id}`)}).toArray();

    const friends = finder[0].user.data.friends.length;

    console.log(friends)

    collection.updateOne(
        { _id: new ObjectId(data.id) },
        {
            $push: {
                "user.data.friends": {
                    friendId: data.friendId,
                    messages: []
                }
            }
        }
    ).then(() => {
        collection.updateOne(
            { _id: new ObjectId(data.friendId) },
            {
                $push: {
                    "user.data.friends": {
                        friendId: data.id,
                        messages: []
                    }
                }
            }
        )
    });
});

router.post('/updatedata', async (req, res) => {
    let data = req.body;

    const finder = await collection.find({_id: new ObjectId(`${data.from}`)}).toArray();

    const friendIndex = finder[0].user.data.friends.findIndex(friendIndex => friendIndex.friendId === data.to);
    const receiver = finder[0].user.data.friends[friendIndex].friendId;

    collection.updateOne(
        { _id: new ObjectId(data.from) },
        { 
            $push: { 
                "user.data.friends.$[friend].messages": {
                    status: "sent",
                    message: data.message
                }
            }
        },
        {
            arrayFilters: [
                { "friend.friendId": data.to }
            ]
        }
    )
    .then(async () => {
        collection.updateOne(
            { _id: new ObjectId(receiver) },
            { 
                $push: { 
                    "user.data.friends.$[friend].messages": {
                        status: "received",
                        message: data.message
                    }
                }
            },
            {
                arrayFilters: [
                    { "friend.friendId": data.from }
                ]
            }
        ).then(() => console.log("Done!"));
    });
});

module.exports = router;
