const dotenv=require('dotenv').config();
const User = require('../../models/userSchema');
const Brand = require('../../models/brandSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Review = require('../../models/reviewSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const reviewSchema = require('../../models/reviewSchema');
const Order=require('../../models/orderSchema')
const Coupon=require('../../models/couponSchema')
const Wallet=require('../../models/walletSchema')
const TempOrder=require('../../models/tempOrderSchema')
const Razorpay = require('razorpay')
const mongoose=require('mongoose')



// const getCart = async (req, res) => {
//   try {
//     if (!req.user) {
//       console.error("No user logged in.");
//       return res.redirect("/login");
//     }
    
//     const cart = await Cart.findOne({ userId: req.user._id }).populate({
//       path: 'items.productId',
//       populate: { path: 'category' } 
//     });
    
//     if (!cart) {
//       return res.render('cart', {
//         cart: { items: [] },
//         summary: { originalPrice: 0, savings: 0, storePickup: 0, tax: 0, total: 0 },
//         relatedProduct: [], user: req.user,
//       });
//     }
    
//     let updated = false;
//     for (const item of cart.items) {
//       const product = item.productId;
//       const categoryOffer = product.category ? product.category.categoryOffer || 0 : 0;
//       const productOffer = product.productOffer || 0;
//       const bestOffer = Math.max(categoryOffer, productOffer);
//       const currentOfferPrice = bestOffer > 0 ? 
//         Math.round(product.salePrice * (1 - bestOffer / 100)) : product.salePrice;
      
//       if (item.price !== currentOfferPrice) {
//         item.price = currentOfferPrice;
//         updated = true;
//       }
//     }
    
//     if (updated) {
//       await cart.save();
//     }
    
 
//     const originalPrice = cart.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
//     const savings = 0; 
//     const storePickup = 99;
//     const tax = originalPrice * 0.1;
//     const total = originalPrice - savings + storePickup + tax;
    
//     const summary = { originalPrice, savings, storePickup, tax, total };
    
   
//     let relatedProduct = [];
//     if (cart.items.length > 0 && cart.items[0].productId) {
//       const cartProductIds = cart.items.map(item => item.productId._id);
//       relatedProduct = await Product.find({
//         category: cart.items[0].productId.category,
//         _id: { $nin: cartProductIds }
//       }).limit(4);
//     }
    
//     res.render('cart', { cart, summary, user: req.user, relatedProduct: relatedProduct });
//   } catch (error) {
//     console.error('Error fetching Cart', error);
//     res.status(500).send("Internal server Error");
//   }
// }

// const addToCart = async (req, res) => {
//   console.log('addToCart route is called');
//   try {
//     const { productId, quantity } = req.body;
    
//     if (!req.user) {
//       return res.status(401).json({ error: 'User not authenticated' });
//     }
  
//     const qty = parseInt(quantity, 10) || 1;
//     const maxLimit = 10; 
  
    
//     const product = await Product.findById(productId).populate('category');
//     if (!product) {
//       return res.status(404).json({ error: 'Product not found' });
//     }
    
//     if (product.quantity < qty) {
//       return res.status(400).json({ error: 'Not enough stock available' });
//     }

   
//     const categoryOffer = product.category ? product.category.categoryOffer || 0 : 0;
//     const productOffer = product.productOffer || 0;
//     const bestOffer = Math.max(categoryOffer, productOffer);
//     const offerPrice = bestOffer > 0 ? Math.round(product.salePrice * (1 - bestOffer / 100)) : product.salePrice;

//     console.log('Product:', product.productName);
//     console.log('Sale Price:', product.salePrice);
//     console.log('Category Offer:', categoryOffer);
//     console.log('Product Offer:', productOffer);
//     console.log('Best Offer:', bestOffer);
//     console.log('Offer Price:', offerPrice);

//     let cart = await Cart.findOne({ userId: req.user._id });
//     if (!cart) {
//       cart = new Cart({ userId: req.user._id, items: [] });
//     }
  
//     const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
//     if (itemIndex > -1) {
//       const newQuantity = cart.items[itemIndex].quantity + qty;
      
//       if (newQuantity > maxLimit) {
//         return res.status(400).json({ error: `You can only add a maximum of ${maxLimit} units for this product.` });
//       }
      
//       if (newQuantity > product.quantity) {
//         return res.status(400).json({ error: 'Not enough stock available' });
//       }
      
//       cart.items[itemIndex].quantity = newQuantity;
//       console.log(`Increased quantity for product ${productId} to ${newQuantity}`);
//     } else {
//       if (qty > maxLimit) {
//         return res.status(400).json({ error: `You can only add a maximum of ${maxLimit} units for this product.` });
//       }
      
//       if (qty > product.quantity) {
//         return res.status(400).json({ error: 'Not enough stock available' });
//       }
      
//       cart.items.push({
//         productId: productId,
//         quantity: qty,
//         price: offerPrice 
//       });
//     }
  
//     await cart.save();
//     return res.status(200).json({ message: 'Product added to cart successfully' });
//   } catch (error) {
//     console.error("Error adding product to cart:", error);
//     return res.status(500).json({ error: "Internal server error" });
//   }
// };

// const updateCart = async (req, res) => {
//   try {
//     const { itemId, quantity } = req.body;
//     const maxLimit = 10;

//     if (!req.user) {
//       return res.status(401).json({ error: 'User not authenticated' });
//     }

//     const cart = await Cart.findOne({ userId: req.user._id });
//     if (!cart) {
//       return res.status(404).json({ error: 'Cart not found' });
//     }

//     const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
//     if (itemIndex === -1) {
//       return res.status(404).json({ error: 'Item not found in cart' });
//     }

//     const product = await Product.findById(cart.items[itemIndex].productId);
//     if (!product) {
//       return res.status(404).json({ error: 'Product not found' });
//     }

//     if (quantity > maxLimit) {
//       return res.status(400).json({ error: `You can only add a maximum of ${maxLimit} units for this product.` });
//     }

//     if (quantity > product.quantity) {
//       return res.status(400).json({ error: 'Not enough stock available' });
//     }

//     cart.items[itemIndex].quantity = quantity;
//     await cart.save();

//     return res.status(200).json({ message: 'Cart updated successfully' });
//   } catch (error) {
//     console.error("Error updating cart:", error);
//     return res.status(500).json({ error: "Internal server error" });
//   }
// }

//   const removeItem=async(req,res)=>{
//     try {
//       const {itemId}=req.body

//       if(!req.user){
//         return res.status(401).json({error:"User not authenticated"})
//       }
//       let cart=await Cart.findOne({userId:req.user._id})
//       if(!cart){
//         return res.status(404).json({error:"Cart not Found"})
//       }
//       const itemIndex=cart.items.findIndex(item=>item._id.toString()===itemId)
//       if(itemIndex===-1){
//         return res.status(404).json({error:"Item not found in the cart"})

//       }
//       cart.items.splice(itemIndex,1)
//       await cart.save();
//       return res.status(200).json({message:"Item remove from the Cart successfully"})

      
//     } catch (error) {
//       console.error("Error removing item from cart:",error)
//       res.status(500).json({error:"Internal sever error"})
      
//     }
//   }

// getCart - Add more detailed response data
const getCart = async (req, res) => {
  try {
    if (!req.user) {
      console.error("No user logged in.");
      return res.redirect("/login");
    }
    
    const cart = await Cart.findOne({ userId: req.user._id }).populate({
      path: 'items.productId',
      populate: { path: 'category' } 
    });
    
    let cartData = cart || { items: [] };
    let updated = false;
    
    for (const item of cartData.items) {
      const product = item.productId;
      const categoryOffer = product.category?.categoryOffer || 0;
      const productOffer = product.productOffer || 0;
      const bestOffer = Math.max(categoryOffer, productOffer);
      const currentOfferPrice = bestOffer > 0 ? 
        Math.round(product.salePrice * (1 - bestOffer / 100)) : product.salePrice;
      
      if (item.price !== currentOfferPrice) {
        item.price = currentOfferPrice;
        updated = true;
      }
    }
    
    if (updated && cart) {
      await cart.save();
    }
    
    const originalPrice = cartData.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const savings = 0;
    const storePickup = 99;
    const tax = originalPrice * 0.1;
    const total = originalPrice - savings + storePickup + tax;
    
    const summary = { originalPrice, savings, storePickup, tax, total };
    
    let relatedProduct = [];
    if (cartData.items.length > 0 && cartData.items[0].productId) {
      const cartProductIds = cartData.items.map(item => item.productId._id);
      relatedProduct = await Product.find({
        category: cartData.items[0].productId.category,
        _id: { $nin: cartProductIds }
      }).limit(4);
    }
    
    // Return JSON for AJAX updates or render for initial load
    if (req.xhr || req.headers.accept.includes('json')) {
      return res.json({
        cart: cartData,
        summary,
        relatedProduct,
        user: req.user
      });
    }
    
    res.render('cart', { cart: cartData, summary, user: req.user, relatedProduct });
  } catch (error) {
    console.error('Error fetching Cart', error);
    res.status(500).send("Internal server Error");
  }
};

// updateCart - Return updated cart data
const updateCart = async (req, res) => {
  try {
    const { itemId, quantity } = req.body;
    const maxLimit = 10;

    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    const product = await Product.findById(cart.items[itemIndex].productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (quantity > maxLimit) {
      return res.status(400).json({ error: `You can only add a maximum of ${maxLimit} units for this product.` });
    }

    if (quantity > product.quantity) {
      return res.status(400).json({ error: 'Not enough stock available' });
    }

    cart.items[itemIndex].quantity = quantity;
    await cart.save();

    const updatedCart = await Cart.findOne({ userId: req.user._id }).populate({
      path: 'items.productId',
      populate: { path: 'category' }
    });

    const originalPrice = updatedCart.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const savings = 0;
    const storePickup = 99;
    const tax = originalPrice * 0.1;
    const total = originalPrice - savings + storePickup + tax;

    return res.status(200).json({
      message: 'Cart updated successfully',
      cart: updatedCart,
      summary: { originalPrice, savings, storePickup, tax, total }
    });
  } catch (error) {
    console.error("Error updating cart:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// addToCart - Return updated cart data
const addToCart = async (req, res) => {
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

    const categoryOffer = product.category?.categoryOffer || 0;
    const productOffer = product.productOffer || 0;
    const bestOffer = Math.max(categoryOffer, productOffer);
    const offerPrice = bestOffer > 0 ? Math.round(product.salePrice * (1 - bestOffer / 100)) : product.salePrice;

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
        price: offerPrice 
      });
    }
  
    await cart.save();
    
    const updatedCart = await Cart.findOne({ userId: req.user._id }).populate({
      path: 'items.productId',
      populate: { path: 'category' }
    });

    const originalPrice = updatedCart.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const savings = 0;
    const storePickup = 99;
    const tax = originalPrice * 0.1;
    const total = originalPrice - savings + storePickup + tax;

    return res.status(200).json({
      message: 'Product added to cart successfully',
      cart: updatedCart,
      summary: { originalPrice, savings, storePickup, tax, total }
    });
  } catch (error) {
    console.error("Error adding product to cart:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// removeItem - Return updated cart data
const removeItem = async (req, res) => {
  try {
    const { itemId } = req.body;

    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      return res.status(404).json({ error: "Cart not Found" });
    }
    
    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: "Item not found in the cart" });
    }
    
    cart.items.splice(itemIndex, 1);
    await cart.save();
    
    const updatedCart = await Cart.findOne({ userId: req.user._id }).populate({
      path: 'items.productId',
      populate: { path: 'category' }
    }) || { items: [] };

    const originalPrice = updatedCart.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const savings = 0;
    const storePickup = 99;
    const tax = originalPrice * 0.1;
    const total = originalPrice - savings + storePickup + tax;

    return res.status(200).json({
      message: "Item removed from the Cart successfully",
      cart: updatedCart,
      summary: { originalPrice, savings, storePickup, tax, total }
    });
  } catch (error) {
    console.error("Error removing item from cart:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


  const checkOut = async (req, res) => {
    try {
      const userId = req.session.userId || req.user._id;
      if (!userId) {
        return res.redirect('/login');
      }
  
      const cart = await Cart.findOne({ userId: userId })
      .populate({
        path: 'items.productId',
        match: { isBlocked: false }, 
        populate: { path: 'category' }
      })
  
      if (!cart || !cart.items || cart.items.length === 0) {
        return res.redirect('/cart');
      }
  
      let updated = false;
      for (const item of cart.items) {
        const product = item.productId;
        const categoryOffer = product.category ? product.category.categoryOffer || 0 : 0;
        const productOffer = product.productOffer || 0;
        const bestOffer = Math.max(categoryOffer, productOffer);
        const currentOfferPrice = bestOffer > 0 ?
          Math.round(product.salePrice * (1 - bestOffer / 100)) : product.salePrice;
  
        if (item.price !== currentOfferPrice) {
          item.price = currentOfferPrice;
          updated = true;
        }
      }
  
      if (updated) {
        await cart.save();
      }
  
      const user = await User.findById(userId);
      let walletBalance = user.wallet || 0;
      const walletDoc = await Wallet.findOne({ userId });
      if (walletDoc) {
        walletBalance = walletDoc.walletBalance;
      }
  
      const addressDocument = await Address.find({ userId: userId }).lean();
      const addresses = addressDocument.reduce((acc, doc) => {
        return acc.concat(doc.address);
      }, []).filter(address => !address.isBlocked);
  
      const coupons = await Coupon.find({
        isList: true,
        createdOn:{$lte:new Date()},
        expireOn: { $gt: new Date() },
        usedBy: { $nin: [userId] } 
      }).lean();
  
      const referralCoupons = await Coupon.find({
        isList: false, 
        userId: userId,
        expireOn: { $gt: new Date() },
        usedBy: { $nin: [userId] } 
      }).lean();
  
      const originalPrice = cart.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      const savings = 0;
      const storePickup = 99;
      const tax = originalPrice * 0.1;
      const total = originalPrice - savings + storePickup + tax;
  
      const summary = { originalPrice, savings, storePickup, tax, total };
  
      const referralCode = user.referralCode;
      const referredBy = user.referredBy;
  
      res.render('checkOut', {
        cart,
        user,
        addresses,
        summary,
        coupons,
        referralCoupons,
        walletBalance,
        referralCode,
        referredBy,
        title: 'Checkout'
      });
    } catch (error) {
      console.error('CheckOut error:', error);
      res.redirect('/cart');
    }
  };

  const placeOrder = async (req, res) => {
    try {
      if (!req.user || !req.user._id) {
        return res.status(401).json({ error: "User not authenticated" });
      }
  
      const userId = req.user._id;
      const { addressId, paymentMethod, coupon, totalPrice, discount, finalAmount, status, couponApplied } = req.body;
  
      if (!addressId || !paymentMethod) {
        return res.status(400).json({ error: "Address and payment method are required." });
      }
  
      const cart = await Cart.findOne({ userId }).populate('items.productId');
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ error: "Your cart is empty." });
      }
  
      for (let item of cart.items) {
        const product = await Product.findById(item.productId._id);
        if (!product) {
          return res.status(400).json({ error: `Product ${item.productId.productName} not found.` });
        }
        if (product.isBlocked) {
          return res.status(400).json({ error: `The product ${product.productName} is currently unavailable.` });
        }
        if (product.quantity < item.quantity) {
          return res.status(400).json({ error: `Not enough stock for ${product.productName}.` });
        }
      }
  
      let cartTotal = 0;
      cart.items.forEach(item => {
        cartTotal += item.price * item.quantity;
      });
  
      let appliedCouponId = null;
      let validatedDiscount = 0;
  
      const newOrder = new Order({
        userId,
        orderedItems: cart.items.map(item => ({
          product: item.productId._id,
          quantity: item.quantity,
          price: item.price
        })),
        totalPrice: cartTotal,
        discount: discount || 0,
        tax: cartTotal * 0.1,
        shipping: 99,
        finalAmount: finalAmount || cartTotal - (discount || 0) + (cartTotal * 0.1) + 99,
        address: addressId,
        paymentMethod,
        status,
        couponApplied: couponApplied || false,
        invoiceDate: new Date(),
      });
  
      if (coupon && couponApplied) {
        const couponDoc = await Coupon.findOne({
          name: coupon,
          createdOn: { $lte: new Date() },
          expireOn: { $gt: new Date() }
        });
  
        if (!couponDoc) {
          return res.status(400).json({ error: "Invalid or expired coupon." });
        }
  
        const isAdminCoupon = couponDoc.isList;
        const isReferralCoupon = couponDoc.userId && couponDoc.userId.includes(userId);
  
        if (!isAdminCoupon && !isReferralCoupon) {
          return res.status(400).json({ error: "You are not authorized to use this coupon." });
        }
  
        if (couponDoc.usedBy && couponDoc.usedBy.includes(userId)) {
          return res.status(400).json({ error: "You have already used this coupon." });
        }
  
        if (cartTotal < couponDoc.minimumPrice) {
          return res.status(400).json({ error: `This coupon requires a minimum purchase of ₹${couponDoc.minimumPrice}.` });
        }
  
        appliedCouponId = couponDoc._id;
        validatedDiscount = couponDoc.offerPrice;
        newOrder.couponId = appliedCouponId;
        newOrder.discount = validatedDiscount;
        newOrder.finalAmount = cartTotal - validatedDiscount + (cartTotal * 0.1) + 99;
      }
  
      await newOrder.save();
  
      if (coupon && couponApplied && appliedCouponId) {
        await Coupon.findByIdAndUpdate(appliedCouponId, {
          $addToSet: { usedBy: userId }
        });
  
        if (couponDoc.referrer) {
          const referral = await ReferralTransaction.findOne({
            referrer: couponDoc.referrer,
            referred: userId,
            status: 'pending'
          });
  
          if (referral) {
            referral.status = 'completed';
            referral.orderId = newOrder._id; 
            await referral.save();
  
            const referrer = await User.findById(couponDoc.referrer);
            referrer.referralCount += 1;
            referrer.wallet += referral.reward;
            await referrer.save();
  
            console.log(`Referral completed for ${referrer.email} by ${userId} with order ${newOrder._id}`);
          } else {
            console.log(`No pending referral found for referrer ${couponDoc.referrer} and user ${userId}`);
          }
        }
      }
  
      for (let item of cart.items) {
        await Product.findByIdAndUpdate(item.productId._id, {
          $inc: { quantity: -item.quantity }
        });
      }
  
      await Cart.deleteOne({ userId });
  
      const user = await User.findById(userId);
      const referredBy = user.referredBy;
      if (referredBy) {
        await User.findByIdAndUpdate(referredBy, { $inc: { wallet: 100 } });
      }
  
      return res.json({
        success: true,
        message: "Order placed successfully!",
        order: newOrder
      });
    } catch (error) {
      console.error('Order placement error:', error.message, error.stack);
      res.status(500).json({ error: "An error occurred while placing your order. Please try again later." });
    }
  };

  const validateCoupon = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
  
      const { couponCode, cartTotal } = req.body;
      const userId = req.user._id;
  
      if (!couponCode || typeof cartTotal === 'undefined') {
        return res.status(400).json({ success: false, message: 'Coupon code or cart total missing' });
      }
  
      const parsedCartTotal = parseFloat(cartTotal);
      if (isNaN(parsedCartTotal)) {
        return res.status(400).json({ success: false, message: 'Invalid cart total' });
      }
  
      const coupon = await Coupon.findOne({ 
        name: couponCode.trim(),
        createdOn:{$lte:new Date()},
        expireOn: { $gt: new Date() }
      });
  
      if (!coupon) {
        return res.status(400).json({ success: false, message: 'Invalid or expired coupon code' });
      }
  
      const isAdminCoupon = coupon.isList;
      const isReferralCoupon = coupon.userId && coupon.userId.includes(userId);
  
      if (!isAdminCoupon && !isReferralCoupon) {
        return res.status(400).json({ success: false, message: "You are not authorized to use this coupon" });
      }
  
      if (coupon.usedBy && coupon.usedBy.includes(userId)) {
        return res.status(400).json({ success: false, message: 'You have already used this coupon' });
      }
  
      if (parsedCartTotal < coupon.minimumPrice) {
        return res.status(400).json({ success: false, message: `This coupon requires a minimum purchase of ₹${coupon.minimumPrice}` });
      }
  
      res.json({
        success: true,
        coupon: {
          name: coupon.name,
          discount: coupon.offerPrice
        }
      });
    } catch (error) {
      console.error('Coupon validation error:', error.message, error.stack);
      res.status(500).json({ success: false, message: 'An error occurred while validating the coupon' });
    }
  };


const createRazorpayOrder = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const { 
      totalPrice, 
      discount,
      finalAmount 
    } = req.body;
    
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    
    const options = {
      amount: Math.round(finalAmount * 100), 
      currency: "INR",
      receipt: "order_" + Date.now(),
      payment_capture: 1
    };
    
    const razorpayOrder = await razorpay.orders.create(options);
    
    res.json({
      success: true,
      key_id: process.env.RAZORPAY_KEY_ID,
      amount: options.amount,
      order_id: razorpayOrder.id
    });
    
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to create payment order. Please try again."
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      addressId,
      paymentMethod,
      coupon,
      totalPrice,
      discount,
      finalAmount,
      couponApplied
    } = req.body;

    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed. Invalid signature."
      });
    }

    const userId = req.user._id;
    const cart = await Cart.findOne({ userId }).populate('items.productId');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "Your cart is empty." });
    }

    for (let item of cart.items) {
      const product = await Product.findById(item.productId._id);
      if (!product) {
        return res.status(400).json({ error: `Product ${item.productId.productName} not found.` });
      }
      if (product.isBlocked) {
        return res.status(400).json({ error: `The product ${product.productName} is currently unavailable.` });
      }
      if (product.quantity < item.quantity) {
        return res.status(400).json({ error: `Not enough stock for ${product.productName}.` });
      }
    }

    let cartTotal = 0;
    cart.items.forEach(item => {
      cartTotal += item.price * item.quantity;
    });

    let appliedCouponId = null;
    let validatedDiscount = 0;

    const newOrder = new Order({
      userId,
      orderedItems: cart.items.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.price
      })),
      totalPrice: cartTotal,
      discount: discount || 0,
      tax: cartTotal * 0.1,
      shipping: 99,
      finalAmount: finalAmount || cartTotal - (discount || 0) + (cartTotal * 0.1) + 99,
      address: addressId,
      paymentMethod: "Razorpay",
      status: "Paid",
      invoiceDate: new Date(),
      paymentDetails: {
        transactionId: razorpay_payment_id,
        orderId: razorpay_order_id
      }
    });

    if (coupon && couponApplied) {
      const couponDoc = await Coupon.findOne({
        name: coupon,
        createdOn: { $lte: new Date() },
        expireOn: { $gt: new Date() }
      });

      if (!couponDoc) {
        return res.status(400).json({ error: "Invalid or expired coupon." });
      }

      const isAdminCoupon = couponDoc.isList;
      const isReferralCoupon = couponDoc.userId && couponDoc.userId.includes(userId);

      if (!isAdminCoupon && !isReferralCoupon) {
        return res.status(400).json({ error: "You are not authorized to use this coupon." });
      }

      if (couponDoc.usedBy && couponDoc.usedBy.includes(userId)) {
        return res.status(400).json({ error: "You have already used this coupon." });
      }

      if (cartTotal < couponDoc.minimumPrice) {
        return res.status(400).json({ error: `This coupon requires a minimum purchase of ₹${couponDoc.minimumPrice}.` });
      }

      appliedCouponId = couponDoc._id;
      validatedDiscount = couponDoc.offerPrice;
      newOrder.couponId = appliedCouponId;
      newOrder.discount = validatedDiscount;
      newOrder.finalAmount = cartTotal - validatedDiscount + (cartTotal * 0.1) + 99;

      await newOrder.save();

      await Coupon.findByIdAndUpdate(appliedCouponId, {
        $addToSet: { usedBy: userId }
      });

      if (couponDoc.referrer) {
        const referral = await ReferralTransaction.findOne({
          referrer: couponDoc.referrer,
          referred: userId,
          status: 'pending'
        });

        if (referral) {
          referral.status = 'completed';
          referral.orderId = newOrder._id;
          await referral.save();

          const referrer = await User.findById(couponDoc.referrer);
          referrer.referralCount += 1;
          referrer.wallet += referral.reward;
          await referrer.save();

          console.log(`Referral completed for ${referrer.email} by ${userId} with order ${newOrder._id}`);
        } else {
          console.log(`No pending referral found for referrer ${couponDoc.referrer} and user ${userId}`);
        }
      }
    } else {
      await newOrder.save();
    }

    for (let item of cart.items) {
      await Product.findByIdAndUpdate(item.productId._id, {
        $inc: { quantity: -item.quantity }
      });
    }

    await Cart.deleteOne({ userId });

    return res.json({
      success: true,
      message: "Payment verified and order placed successfully!",
      order: newOrder
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: "An error occurred during payment verification."
    });
  }
};

const paymentFailed = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    console.log("Looking up failed payment with order ID:", orderId);
    
    let order = null;
    let orderFound = false;
    
    order = await Order.findOne({ orderId: orderId });
    
    if (!order) {
      order = await Order.findOne({ "paymentDetails.orderId": orderId });
    }
    
    if (!order && mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId);
    }

    if (order) {
      orderFound = true;
      console.log("Found order for failed payment:", order._id);
    } else {
      console.log("Order not found for ID:", orderId);
    }
    
    res.render('paymentFailed', { 
      orderId: order ? order.orderId : orderId,
      orderFound: orderFound,
      order: order,
      user: req.user || {}
    });
    
  } catch (error) {
    console.error("Error in payment failure page:", error);
    res.render('paymentFailed', {
      orderId: req.params.orderId,
      orderFound: false,
      order: null,
      user: req.user || {},
      errorMessage: "An error occurred while retrieving order details."
    });
  }
};

const retryPayment = async (req, res) => {
  try {
      if (!req.user || !req.user._id) {
          return res.status(401).json({ error: 'User not authenticated' });
      }

      const { 
          addressId,
          paymentMethod,
          coupon,
          totalPrice,
          discount,
          finalAmount
      } = req.body;

      if (!addressId || !paymentMethod || !totalPrice || !finalAmount) {
          return res.status(400).json({
              success: false,
              message: "Missing required fields for retry payment."
          });
      }

      if (paymentMethod !== 'Razorpay') {
          return res.status(400).json({
              success: false,
              message: "Invalid payment method for retry"
          });
      }

      const razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET
      });

      const options = {
          amount: Math.round(finalAmount * 100),
          currency: 'INR',
          receipt: 'retry_' + Date.now(),
          payment_capture: 1
      };

      const razorpayOrder = await razorpay.orders.create(options);

      const tempOrder = new TempOrder({
          userId: req.user._id,
          razorpayOrderId: razorpayOrder.id,
          orderDetails: {
              addressId,
              paymentMethod,
              coupon,
              totalPrice,
              discount,
              finalAmount
          },
          createdAt: new Date()
      });

      await tempOrder.save();

      res.json({
          success: true,
          key_id: process.env.RAZORPAY_KEY_ID,
          amount: options.amount,
          order_id: razorpayOrder.id
      });

  } catch (error) {
      console.error("Retry payment error:", error);
      res.status(500).json({
          success: false,
          message: "Failed to create payment order. Please try again"
      });
  }
};
const verifyRetryPayment = async (req, res) => {
  try {
      if (!req.user || !req.user._id) {
          return res.status(401).json({ error: 'User not authenticated' });
      }

      const { 
          razorpay_payment_id, 
          razorpay_order_id, 
          razorpay_signature 
      } = req.query;

      console.log("Verifying Retry Payment:", { razorpay_payment_id, razorpay_order_id, razorpay_signature });

      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
      hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
      const generatedSignature = hmac.digest('hex');

      if (generatedSignature !== razorpay_signature) {
          console.error("Signature Mismatch:", { generatedSignature, razorpay_signature });
          return res.redirect(`/order/payment-failed/${razorpay_order_id}`);
      }

      const tempOrder = await TempOrder.findOne({
          userId: req.user._id,
          razorpayOrderId: razorpay_order_id
      });

      if (!tempOrder) {
          console.error("TempOrder Not Found:", razorpay_order_id);
          return res.redirect('/checkout');
      }

      const orderDetails = tempOrder.orderDetails;

      const userId = req.user._id;
      const cart = await Cart.findOne({ userId }).populate('items.productId');

      if (!cart || cart.items.length === 0) {
          console.error("Cart is Empty for User:", userId);
          return res.redirect('/cart');
      }
      for (let item of cart.items) {
        const product = await Product.findById(item.productId._id);
        if (!product) {
          return res.redirect('/cart');
        }
        if (product.isBlocked) {
          return res.status(400).json({ error: `The product ${product.productName} is currently unavailable.` });
        }
        if (product.quantity < item.quantity) {
          return res.status(400).json({ error: `Not enough stock for ${product.productName}.` });
        }
      }

      const newOrder = new Order({
          userId,
          orderedItems: cart.items.map(item => ({
              product: item.productId._id,
              quantity: item.quantity,
              price: item.price
          })),
          totalPrice: orderDetails.totalPrice,
          discount: orderDetails.discount,
          finalAmount: orderDetails.finalAmount,
          address: orderDetails.addressId,
          paymentMethod: 'Razorpay',
          status: "Paid",
          invoiceDate: new Date(),
          paymentDetails: {
              transactionId: razorpay_payment_id,
              orderId: razorpay_order_id
          }
      });

      await newOrder.save();

      for (let item of cart.items) {
          await Product.findByIdAndUpdate(item.productId._id, {
              $inc: { quantity: -item.quantity }
          });
      }

      await Cart.deleteOne({ userId });
      await TempOrder.deleteOne({ _id: tempOrder._id });

      return res.redirect(`/order/confirmation/${newOrder._id}`);

  } catch (error) {
    console.error("Retry payment verification error details:", {
      message: error.message,
      stack: error.stack,
      user: req.user?._id,
      query: req.query
    });
    return res.redirect(`/order/payment-failed/unknown`);
  }
};




module.exports = { getCart, addToCart,updateCart,removeItem,checkOut ,placeOrder,
  validateCoupon,verifyPayment,createRazorpayOrder,paymentFailed,retryPayment,verifyRetryPayment};
