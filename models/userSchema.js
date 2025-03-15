const mongoose = require('mongoose');
const { Schema } = mongoose;
const crypto = require('crypto');

const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    profile_image: { 
        type: String, 
        default: null 
    },
    referralCode: { 
        type: String,
        unique: true,
        sparse: true
    },
    referredBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    referralCount: {
        type: Number,
        default: 0
    },
    phone: {
        type: String,
        unique: true,
        sparse: true,
        default: null
    },
    googleId: { 
        type: String, 
        unique: true, 
        sparse: true 
    },
    password: { 
        type: String, 
        required: false 
    },
    isBlocked: { 
        type: Boolean, 
        default: false 
    },
    isAdmin: { 
        type: Boolean, 
        default: false 
    },
    wallet: { 
        type: Number, 
        default: 0 
    },
    createdOn: { 
        type: Date, 
        default: Date.now 
    }
});

userSchema.pre('save', function(next) {
    if (!this.referralCode && this.isNew) {
        const timestamp = new Date().getTime().toString();
        const hash = crypto.createHash('md5').update(this.email + timestamp).digest('hex');
        this.referralCode = hash.substring(0, 8).toUpperCase();
        console.log('Generated referralCode for user:', this.email, this.referralCode);
    } else {
        console.log('Referral code not generated. isNew:', this.isNew, 'Existing referralCode:', this.referralCode);
    }
    next();
});

const User = mongoose.model('User', userSchema);
module.exports = User;