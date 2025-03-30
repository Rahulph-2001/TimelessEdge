const mongoose = require('mongoose');
const { Schema } = mongoose;

const cartItemSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  quantity: {
    type: Number,
    default: 1
  },
  price: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    default: 'placed'
  },
  cancellationReason: {
    type: String,
    default: "none"
  }
});

const cartSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  items: [cartItemSchema]
});

cartSchema.virtual('total').get(function() {
  return this.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
});

cartSchema.set('toJSON', { virtuals: true });
cartSchema.set('toObject', { virtuals: true });

const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;
