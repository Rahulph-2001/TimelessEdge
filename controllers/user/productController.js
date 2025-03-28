
const User = require('../../models/userSchema');
const Brand = require('../../models/brandSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Review = require('../../models/reviewSchema');
const wishList=require('../../models/whishlistSchema');
const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema');
const Address=require('../../models/addressSchema')


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
        const categoryOffer=product.category?product.category.categoryOffer||0:0;

        const productOffer=product.productOffer||0;
        const bestOffer=Math.max(categoryOffer,productOffer)

        let finalPrice=product.salePrice
        let offerPrice=null;
        let savedAmount=null
        let offerType=null;

        if(bestOffer>0){
          offerPrice=Math.round(product.salePrice*(1-bestOffer/100))
          savedAmount=product.salePrice-offerPrice;
          offerType=productOffer >categoryOffer ?'product':'category'
          finalPrice=offerPrice
        }


        const productData = {
          _id: product._id, 
            name: product.productName,
            price: finalPrice,
            regularPrice: product.regularPrice,
            description: product.description,
            brand: product.brand.name,
            stockCode: product._id,
            quantity: product.quantity,
            image: product.productImages[0],
            images: product.productImages,
            category:product.category.name,
            categoryOffer,
            productOffer,
            bestOffer,
            savedAmount,
            offerType
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
        
        const cart = await Cart.findOne({
            userId,
            items: {
                $elemMatch: {
                    productId: productId
                }
            }
        });
        
        if (cart) {
            return res.status(409).json({ message: "Product already in your cart" });
        }
        
        let wishlist = await wishList.findOne({ userId });
        
        if (!wishlist) {
            wishlist = new wishList({ userId, products: [] });
        }
        
        const productExists = wishlist.products.some(item => 
            item.productId && item.productId.toString() === productId
        );
        
        if (productExists) {
            return res.status(409).json({ message: "Product already in wishlist" });
        }
        
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
              select: 'productName salePrice status productImage productImages colorStock category productOffer',
              populate: {
                  path: 'category',
                  select: 'categoryOffer'
              }
          });

      const formattedWishlist = {
          items: wishlistData && wishlistData.products ?
              wishlistData.products.filter(item => item.productId).map(item => {
                  const product = item.productId;

                  const categoryOffer = product.category ? product.category.categoryOffer || 0 : 0;

                  const productOffer = product.productOffer || 0;

                  const bestOffer = Math.max(categoryOffer, productOffer);

                  let finalPrice = product.salePrice;
                  let offerPrice = null;
                  let savedAmount = null;
                  let offerType = null;

                  if (bestOffer > 0) {
                      offerPrice = Math.round(product.salePrice * (1 - bestOffer / 100));
                      savedAmount = product.salePrice - offerPrice;
                      offerType = productOffer > categoryOffer ? 'product' : 'category';
                  }

                  return {
                      ...item,
                      productId: {
                          ...product._doc,
                          categoryOffer,
                          productOffer,
                          bestOffer,
                          offerPrice,
                          savedAmount,
                          offerType
                      }
                  };
              }) : []
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

      
      const product = await Product.findById(productId).populate('category');
      if (!product) {
          return res.status(404).json({ error: 'Product not found' });
      }

      if (product.quantity < qty) {
          return res.status(400).json({ error: 'Not enough stock available' });
      }

   
      const categoryOffer = product.category ? product.category.categoryOffer || 0 : 0;
      const productOffer = product.productOffer || 0;
      const bestOffer = Math.max(categoryOffer, productOffer);
      const finalPrice = bestOffer > 0 ? Math.round(product.salePrice * (1 - bestOffer / 100)) : product.salePrice;

      
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
              price: finalPrice 
          });
      }

     
      await cart.save();

     
      const userWishlist = await wishList.findOne({ userId: req.user._id });
      if (userWishlist) {
          const productIndex = userWishlist.products.findIndex(
              item => item.productId && item.productId.toString() === productId
          );

          if (productIndex > -1) {
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

  const removeWishlist=async(req,res)=>{
    try {
      
        const userId=req.session.user
        const {productId}=req.params;

        if(!userId){
          return res.redirect('/login')
        }
        const updateWishlist= await wishList.findOneAndUpdate({userId},{$pull:{products:{productId}}},{new:true})

        if(!updateWishlist){
          res.status(404).json({error:'Wishlist not Found'})
        }
        res.json({success:true,message:'Product removed from wishList'})

    } catch (error) {
      
      console.error("error removing product from wishlist",error)
      res.status(500).json({error:'Internal Server Error'})
    }
  }
  


  const submitReview = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Please login to submit Review' });
        }

        const userId = req.session.user._id;
        const { productId, review, rating } = req.body;

        console.log('Received data:', { userId, productId, review, rating });

        if (!productId || !review || !rating) {
            return res.status(400).json({ success: false, message: 'ProductId, Rating, and Review text are required' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const addressDocs = await Address.find({ userId: userId });
        const addressIds = [];
        
        addressDocs.forEach(doc => {
            if (doc.address && Array.isArray(doc.address)) {
                doc.address.forEach(addr => {
                    addressIds.push(addr._id);
                });
            }
        });


        const order = await Order.findOne({
            address: { $in: addressIds }, 
            'orderedItems.product': productId,
            'orderedItems.status': 'Delivered'
        });


        if (!order) {
            return res.status(403).json({ success: false, message: 'You can only review products you have purchased and received' });
        }

        const existingReview = await Review.findOne({
            user: userId,
            product: productId
        });

        if (existingReview) {
            return res.status(400).json({ success: false, message: 'You have already reviewed this product' });
        }

        const newReview = new Review({
            user: userId,
            product: productId,
            rating: parseInt(rating),
            review: review.trim()
        });

        await newReview.save();

        return res.status(200).json({ success: true, message: 'Review submitted successfully' });

    } catch (error) {
        console.error('Error submitting Review:', error);
        return res.status(500).json({ success: false, message: 'Error submitting review. Please try again later.' });
    }
};
    



module.exports = {
    productDetails,
    addWhishlist,
    wishListPage,
    addToCartFromWishlist,
    removeWishlist,
    submitReview
    
};

