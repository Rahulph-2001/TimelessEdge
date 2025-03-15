const mongoose = require("mongoose");
const { Schema } = mongoose;

const referralTransactionSchema = new Schema({
    referrer: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    referred: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: false 
    },
    reward: { 
        type: Number, 
        required: true 
    },
    orderId: { 
        type: Schema.Types.ObjectId, 
        ref: 'Order', 
        required: false 
    },
    status: { 
        type: String, 
        enum: ['pending', 'completed', 'rejected'], 
        default: 'pending' 
    },
    reason: { 
        type: String, 
        required: false 
    },
}, { 
    timestamps: true 
});

referralTransactionSchema.index({ referrer: 1 });
referralTransactionSchema.index({ referred: 1 });
referralTransactionSchema.index({ status: 1 });

const ReferralTransaction = mongoose.model("ReferralTransaction", referralTransactionSchema);

module.exports = ReferralTransaction;