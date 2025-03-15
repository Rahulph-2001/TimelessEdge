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
            default: 0,
        },
        color: {
            type: String,
            required: true,
        },
        productImages: {
            type: [String],
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

productSchema.methods.getFinalPrice = function() {
    let highestOffer = this.productOffer || 0;
    
    if (this.category && this.category.categoryOffer) {
        highestOffer = Math.max(highestOffer, this.category.categoryOffer);
    }
    
    if (highestOffer > 0) {
        const discountAmount = (this.salePrice * highestOffer) / 100;
        return this.salePrice - discountAmount;
    }
    
    return this.salePrice;
};


productSchema.virtual('highestOffer').get(function() {
    if (!this.category) return this.productOffer || 0;
    
    const productOffer = this.productOffer || 0;
    const categoryOffer = this.category.categoryOffer || 0;
    
    return Math.max(productOffer, categoryOffer);
});


productSchema.virtual('offerSource').get(function() {
    if (!this.category) return this.productOffer > 0 ? 'product' : null;
    
    const productOffer = this.productOffer || 0;
    const categoryOffer = this.category.categoryOffer || 0;
    
    if (productOffer > categoryOffer) return 'product';
    if (categoryOffer > productOffer) return 'category';
    if (productOffer > 0) return 'both'; 
    
    return null; 
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;