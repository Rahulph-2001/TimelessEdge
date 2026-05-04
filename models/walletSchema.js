const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true  
    },
    walletBalance: {
        type: Number,
        required: true,
        min: 0
    },
    transactions: [{
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        },
        transactionId: {
            type: String,
            default: uuidv4,
            unique: true
        },
        transactionType: {
            type: String,
            enum: ['debit', 'credit'],
            required: true
        },
        transactionAmount: {
            type: Number,
            required: true,
            min: 0
        },
        transactionDate: {
            type: Date,
            default: Date.now
        },
        transactionStatus: {
            type: String,
            enum: ["pending", "completed", "failed"],
            default: "completed"
        },
        transactionDescription: {
            type: String
        }
    }]
}, { timestamps: true });

// Balance is managed explicitly in controllers - no auto-adjustment in pre-save

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;
