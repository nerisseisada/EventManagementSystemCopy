const mongoose = require('mongoose');

const users = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    role: String,
    }, {
    timestamps: {
        createdAt: 'timestamp',
        updatedAt: false,
    }
});

const user = mongoose.model("user", users);
module.exports = user;