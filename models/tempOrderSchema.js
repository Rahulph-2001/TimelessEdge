const mongoose = require("mongoose");
const { Schema } = mongoose;

const tempOrderSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    razorpayOrderId: {
        type: String,
        required: true
    },
    orderDetails: {
        addressId: {
            type: Schema.Types.ObjectId,
            ref: "Address",
            required: true
        },
        paymentMethod: String,
        coupon: String,
        totalPrice: Number,
        discount: Number,
        finalAmount: Number
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 3600 
    }
});

const TempOrder = mongoose.model("TempOrder", tempOrderSchema);

module.exports = TempOrder;