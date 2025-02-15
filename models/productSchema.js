const mongoose = require("mongoose");
const { Schema } = mongoose;

const productSchema = new Schema(
    {
        productName: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        brand: {
            type: Schema.Types.ObjectId,
            ref: "Brand",
            required: true,
        },
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        regularPrice: {
            type: Number,
            required: true,
        },
        salePrice: {
            type: Number,
            required: true,
        },
        productOffer: {
            type: Number,
            default: 0,
        },
        quantity: {
            type: Number,
            default: 0, // Fix incorrect default type
        },
        color: {
            type: String, // Fix field name to lowercase
            required: true,
        },
        productImages: {
            type: [String], // Ensure consistency with addProducts function
            required: true,
        },
        isBlocked: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: ["Available", "Out of Stock", "Discontinued"],
            required: true,
            default: "Available",
        },
    },
    { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
