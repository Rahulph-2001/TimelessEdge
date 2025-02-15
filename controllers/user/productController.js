const User=require('../../models/userSchema')
const Brand=require('../../models/brandSchema')
const Category=require('../../models/categorySchema')
const Product=require('../../models/productSchema')
const { validateProduct, validateSearchQuery } = require('../../config/validation');
const Review = require('../../models/reviewSchema')

const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.query.id;

        const product = await Product.findById(productId)
            .populate('category')
            .populate('brand');

        if (!product) {
            return res.redirect("/pageNotFound");
        }

        const reviews = await Review.find({ product: productId })
            .populate('user', 'name') 
            .sort({ createdAt: -1 });

        const userData = await User.findById(userId);
        const productData = {
            name: product.productName,
            price: product.salePrice,
            regularPrice: product.regularPrice,
            description: product.description,
            brand: product.brand.name,
            stockCode: product._id,
            quantity: product.quantity,
            image: product.productImages[0],
            images: product.productImages
        };

        res.render("product-details", {
            product: productData,
            user: userData,
            category: product.category,
            reviews: reviews
        });

    } catch (error) {
        console.error("Error fetching product details:", error);
        res.redirect('/pageNotFound');
    }
};

module.exports = {
    productDetails,
};
