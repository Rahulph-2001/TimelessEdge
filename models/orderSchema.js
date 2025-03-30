const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

const orderSchema = new Schema({
    orderId: {
        type: String,
        default: () => uuidv4(),
        unique: true
    },
    orderedItems: [{
        product: {
           type: Schema.Types.ObjectId,
           ref: "Product",
           required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            default: 0
        },
        status: {
            type: String,
            enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned'],
            default: 'Pending'
        },
        cancellationReason: String,
        cancelledAt: Date,
        returnReason: String,
        returnRequestedOn: Date,
        returnedOn: Date
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        required: true
    },
    address: {
        type: Schema.Types.ObjectId,
        ref: "Address",
        required: true
    },
    invoiceDate: {
        type: Date
    },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Processing', 'Paid', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned'],
        default: 'Pending'
    },
    paymentMethod: {
        type: String,
        enum: ['Credit Card', 'Debit Card', 'Razorpay', 'NetBanking', 'Wallet', 'COD', 'Other'],
        default: 'Online Payment'
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    paymentDetails: {
        transactionId: String,
        orderId: String
    },
    couponApplied: {
        type: Boolean,
        default: false
    },
    cancellationReason: String,
    cancellationDate: Date,
    referredBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    referralReward: {
        type: Number,
        default: 0
    }
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;