
const User = require('../../models/userSchema');
const Brand = require('../../models/brandSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Review = require('../../models/reviewSchema');
const wishList=require('../../models/whishlistSchema');
const Cart = require('../../models/cartSchema');

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

        // Fetch related products in the same category.
        // Make sure to exclude the current product using $ne.
        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id }
        })
            .limit(4)
            .populate('category')
            .populate('brand');

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
            reviews: reviews,
            relatedProducts: relatedProducts
        });

    } catch (error) {
        console.error("Error fetching product details:", error);
        res.redirect('/pageNotFound');
    }
};

const addWhishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        
        const productId = req.params.id;
        let wishlist = await wishList.findOne({ userId });
        
        if (!wishlist) {
            wishlist = new wishList({ userId, products: [] });
        }
        
        // Check if product already exists in wishlist
        const productExists = wishlist.products.some(item => 
            item.productId && item.productId.toString() === productId
        );
        
        if (productExists) {
            return res.status(200).json({ message: "Product already in wishlist" });
        }
        
        // Add product to wishlist
        wishlist.products.push({ productId });
        await wishlist.save();
        
        return res.status(200).json({ message: 'Product added to wishlist successfully' });
    } catch (error) {
        console.error("Error adding to wishlist:", error);
        return res.status(500).json({ message: "Error adding product to wishlist" });
    }
};
const wishListPage = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect("/login");
        }
        
        const wishlistData = await wishList.findOne({ userId })
            .populate({
                path: 'products.productId',
                select: 'productName salePrice status productImage productImages colorStock'
            });
        
        // Make sure we have a valid wishlist with populated products
        const formattedWishlist = {
            items: wishlistData && wishlistData.products ? 
                wishlistData.products.filter(item => item.productId) : []
        };
        
        res.render('wishlist', { 
            wishlist: formattedWishlist,
            user: req.user
        });
    } catch (error) {
        console.error("Error fetching wishList:", error);
        res.status(500).send("Internal Server error");
    }
};
const addToCartFromWishlist = async (req, res) => {
    try {
      const { productId, quantity } = req.body;
      
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
    
      const qty = parseInt(quantity, 10) || 1;
      const maxLimit = 10; 
    
      // First, add the product to the cart (reusing your existing logic)
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      if (product.quantity < qty) {
        return res.status(400).json({ error: 'Not enough stock available' });
      }
    
      let cart = await Cart.findOne({ userId: req.user._id });
      if (!cart) {
        cart = new Cart({ userId: req.user._id, items: [] });
      }
    
      const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
      if (itemIndex > -1) {
        const newQuantity = cart.items[itemIndex].quantity + qty;
        
        if (newQuantity > maxLimit) {
          return res.status(400).json({ error: `You can only add a maximum of ${maxLimit} units for this product.` });
        }
        
        if (newQuantity > product.quantity) {
          return res.status(400).json({ error: 'Not enough stock available' });
        }
        
        cart.items[itemIndex].quantity = newQuantity;
      } else {
        if (qty > maxLimit) {
          return res.status(400).json({ error: `You can only add a maximum of ${maxLimit} units for this product.` });
        }
        
        if (qty > product.quantity) {
          return res.status(400).json({ error: 'Not enough stock available' });
        }
        
        cart.items.push({
          productId: productId,
          quantity: qty,
          price: product.salePrice
        });
      }
    
      await cart.save();
      
      // Now, remove the product from the wishlist
      const userWishlist = await wishList.findOne({ userId: req.user._id });
      
      if (userWishlist) {
        // Find the product in the wishlist
        const productIndex = userWishlist.products.findIndex(
          item => item.productId && item.productId.toString() === productId
        );
        
        if (productIndex > -1) {
          // Remove the product from the wishlist
          userWishlist.products.splice(productIndex, 1);
          await userWishlist.save();
        }
      }
      
      return res.status(200).json({ 
        message: 'Product added to cart and removed from wishlist successfully' 
      });
      
    } catch (error) {
      console.error("Error processing cart and wishlist operation:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
  

module.exports = {
    productDetails,
    addWhishlist,
    wishListPage,
    addToCartFromWishlist
    
};

