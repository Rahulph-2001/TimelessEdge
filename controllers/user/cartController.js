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
    
    if (!cart) {
      return res.render('cart', {
        cart: { items: [] },
        summary: { originalPrice: 0, savings: 0, storePickup: 0, tax: 0, total: 0 },
        relatedProduct: [], user: req.user,
      });
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
    
 
    const originalPrice = cart.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const savings = 0; 
    const storePickup = 99;
    const tax = originalPrice * 0.1;
    const total = originalPrice - savings + storePickup + tax;
    
    const summary = { originalPrice, savings, storePickup, tax, total };
    
   
    let relatedProduct = [];
    if (cart.items.length > 0 && cart.items[0].productId) {
      const cartProductIds = cart.items.map(item => item.productId._id);
      relatedProduct = await Product.find({
        category: cart.items[0].productId.category,
        _id: { $nin: cartProductIds }
      }).limit(4);
    }
    
    res.render('cart', { cart, summary, user: req.user, relatedProduct: relatedProduct });
  } catch (error) {
    console.error('Error fetching Cart', error);
    res.status(500).send("Internal server Error");
  }
}

const addToCart = async (req, res) => {
  console.log('addToCart route is called');
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
    const offerPrice = bestOffer > 0 ? Math.round(product.salePrice * (1 - bestOffer / 100)) : product.salePrice;

    console.log('Product:', product.productName);
    console.log('Sale Price:', product.salePrice);
    console.log('Category Offer:', categoryOffer);
    console.log('Product Offer:', productOffer);
    console.log('Best Offer:', bestOffer);
    console.log('Offer Price:', offerPrice);

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
      console.log(`Increased quantity for product ${productId} to ${newQuantity}`);
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
    return res.status(200).json({ message: 'Product added to cart successfully' });
  } catch (error) {
    console.error("Error adding product to cart:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const updateCart=async(req,res)=>{
  try{
  
  const {itemId,quantity}=req.body;
  if(!req.user){
    return res.status(401).json({error:"User not authenticated"})

  }
  let cart=await Cart.findOne({userId:req.user._id})
  if(!cart){
    return res.status(404).json({error:"Cart not found"})
  }
  const itemIndex=cart.items.findIndex(item=>item._id.toString()===itemId);
  if(itemIndex===-1){
    return res.status(404).json({error:"Item not found in cart"})
  }

  const product=await Product.findById(cart.items[itemIndex].productId)
  if(!product||quantity>product.quantity){
    return res.status(400).json({error:"Not enough Stock availabe"})
  }
  cart.items[itemIndex].quantity=quantity
  await cart.save()
  res.status(200).json({message:"Cart updated successfully"})
}catch(error){
   console.error("Error updating cart:",error)
   res.status(500).json({error:"Internal server error"})
}
}

  const removeItem=async(req,res)=>{
    try {
      const {itemId}=req.body

      if(!req.user){
        return res.status(401).json({error:"User not authenticated"})
      }
      let cart=await Cart.findOne({userId:req.user._id})
      if(!cart){
        return res.status(404).json({error:"Cart not Found"})
      }
      const itemIndex=cart.items.findIndex(item=>item._id.toString()===itemId)
      if(itemIndex===-1){
        return res.status(404).json({error:"Item not found in the cart"})

      }
      cart.items.splice(itemIndex,1)
      await cart.save();
      return res.status(200).json({message:"Item remove from the Cart successfully"})

      
    } catch (error) {
      console.error("Error removing item from cart:",error)
      res.status(500).json({error:"Internal sever error"})
      
    }
  }

  const checkOut = async (req, res) => {
    try {
        const userId = req.session.userId || req.user._id;
        if (!userId) {
            return res.redirect('/login');
        }

        const cart = await Cart.findOne({ userId: userId })
            .populate({
                path: 'items.productId',
                populate: { path: 'category' } // Make sure to populate category
            });

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.redirect('/cart');
        }

        // Recalculate prices based on current offers - using the same logic as cart controller
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

        const addressDocument = await Address.find({ userId: userId }).lean();

        const addresses = addressDocument.reduce((acc, doc) => {
            return acc.concat(doc.address);
        }, []).filter(address => !address.isBlocked);

        const coupons = await Coupon.find({
            isList: true,
            expireOn: { $gt: new Date() }
        }).lean();

        // Calculate summary using the same logic as cart controller
        const originalPrice = cart.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const savings = 0; 
        const storePickup = 99;
        const tax = originalPrice * 0.1;
        const total = originalPrice - savings + storePickup + tax;
        
        const summary = { originalPrice, savings, storePickup, tax, total };

        res.render('checkOut', {
            cart,
            user,
            addresses,
            summary,
            coupons,
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
      const { 
          addressId, 
          paymentMethod, 
          coupon, 
          totalPrice, 
          discount, 
          finalAmount, 
          status, 
          couponApplied 
      } = req.body;
      
      if (!addressId) {
          return res.status(400).json({ error: "Please select a valid address." });
      }
      
      const cart = await Cart.findOne({ userId }).populate('items.productId');
      if (!cart || cart.items.length === 0) {
          return res.status(400).json({ error: "Your cart is empty. Please add products before placing an order." });
      }
      
      // Check product availability
      for (let item of cart.items) {
          const product = await Product.findById(item.productId._id);
          if (!product || product.quantity < item.quantity) {
              return res.status(400).json({ error: `Not enough stock for ${product.productName}` });
          }
      }
      
      // Calculate cart total
      let cartTotal = 0;
      cart.items.forEach(item => {
          cartTotal += item.price * item.quantity;
      });
      
      // Apply coupon if provided
      let appliedCouponId = null;
      let validatedDiscount = 0;
      
      if (coupon && couponApplied) {
          const couponDoc = await Coupon.findOne({ 
              name: coupon, 
              isList: true, 
              expireOn: { $gt: new Date() } 
          });
          
          if (!couponDoc) {
              return res.status(400).json({ error: "Invalid or expired coupon." });
          }
          
          if (cartTotal < couponDoc.minimumPrice) {
              return res.status(400).json({
                  error: `This coupon requires a minimum purchase of ₹${couponDoc.minimumPrice}.`
              });
          }
          
          // Check if user has already used this coupon
          if (couponDoc.userId && couponDoc.userId.includes(userId)) {
              return res.status(400).json({ error: "You have already used this coupon." });
          }
          
          appliedCouponId = couponDoc._id;
          validatedDiscount = couponDoc.offerPrice;
          
          // Add user to coupon's used list
          await Coupon.findByIdAndUpdate(couponDoc._id, {
              $addToSet: { userId: userId }
          });
      }
      
      // Calculate final amount
      const calculatedFinalAmount = cartTotal - validatedDiscount;
      const tax = calculatedFinalAmount * 0.1;
      const shipping = 99;
      const grandTotal = calculatedFinalAmount + tax + shipping;
      
      // Create order items
      const orderedItems = cart.items.map(item => ({
          product: item.productId._id,
          quantity: item.quantity,
          price: item.price
      }));
      
      // Create new order
      const newOrder = new Order({
          userId,
          orderedItems,
          totalPrice: cartTotal,
          discount: validatedDiscount,
          tax: tax,
          shipping: shipping,
          finalAmount: grandTotal,
          address: addressId,
          paymentMethod,
          status,
          couponApplied: validatedDiscount > 0,
          couponId: appliedCouponId,
          invoiceDate: new Date()
      });
      
      await newOrder.save();
      
      // Update product inventory
      for (let item of cart.items) {
          await Product.findByIdAndUpdate(item.productId._id, { 
              $inc: { quantity: -item.quantity } 
          });
      }
      
      // Clear cart
      await Cart.deleteOne({ userId });
      
      return res.json({
          success: true,
          message: "Order placed successfully!",
          order: newOrder
      });
      
  } catch (error) {
      console.error('Order placement error:', error.message, error.stack);
      res.status(500).json({ 
          error: "An error occurred while placing your order. Please try again later." 
      });
  }
};


const validateCoupon= async (req, res) => {
  try {
      if (!req.user) {
          return res.status(401).json({ success: false, message: 'User not authenticated' });
      }
      
      const { couponCode, cartTotal } = req.body;
      
      // Find valid coupon
      const coupon = await Coupon.findOne({ 
          name: couponCode, 
          isList: true,
          expireOn: { $gt: new Date() }
      });
      
      if (!coupon) {
          return res.status(400).json({ 
              success: false, 
              message: 'Invalid or expired coupon code' 
          });
      }
      
      // Check if coupon has minimum price requirement
      if (parseFloat(cartTotal) < coupon.minimumPrice) {
          return res.status(400).json({ 
              success: false, 
              message: `This coupon requires a minimum purchase of ₹${coupon.minimumPrice}` 
          });
      }
      
      // Check if user has already used this coupon
      if (coupon.userId && coupon.userId.includes(req.user._id)) {
          return res.status(400).json({ 
              success: false, 
              message: 'You have already used this coupon' 
          });
      }
      
      res.json({
          success: true,
          coupon: {
              name: coupon.name,
              discount: coupon.offerPrice
          }
      });
      
  } catch (error) {
      console.error('Coupon validation error:', error);
      res.status(500).json({ 
          success: false, 
          message: 'An error occurred while validating the coupon'
      });
  }
}

module.exports = { getCart, addToCart,updateCart,removeItem,checkOut ,placeOrder,validateCoupon};
