import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50
    },
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
    },
    profilePicture: {
        type: String,
        default: ''
    },
    about: {
        type: String,
        default: "Hey there! I am using ChatApp.",
        maxlength: 150
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date,
        default: null
    },
    refreshToken: {
        type: String,
        default: null
    }

},{ timestamps: true });

const UserModel = mongoose.model('User', userSchema);

export default UserModel;