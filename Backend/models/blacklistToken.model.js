const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const blacklistTokenModel = new Schema({
    token: {
        type: String,
        required: true,
        unique: true
    },
    createdAt: { 
        type: Date,
        default: Date.now,
        expires: 86400
    }
});


module.exports = mongoose.model('blacklistToken', blacklistTokenModel)