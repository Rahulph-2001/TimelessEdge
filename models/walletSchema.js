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

walletSchema.pre('save', function(next) {
    if (this.transactions.length > 0) {
        const lastTransaction = this.transactions[this.transactions.length - 1];
        if (lastTransaction.transactionDescription.includes('Wallet payment')) {
            if (lastTransaction.transactionType === 'credit') {
                this.walletBalance += lastTransaction.transactionAmount;
            } else if (lastTransaction.transactionType === 'debit') {
                if (this.walletBalance < lastTransaction.transactionAmount) {
                    return next(new Error('Insufficient balance for this transaction'));
                }
                this.walletBalance -= lastTransaction.transactionAmount;
            }
        }
    }
    next();
});

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;
