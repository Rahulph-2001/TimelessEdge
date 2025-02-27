const User = require('../../models/userSchema');
const Brand = require('../../models/brandSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Review = require('../../models/reviewSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const reviewSchema = require('../../models/reviewSchema');
const Order=require('../../models/orderSchema')

const getCart = async(req, res) => {

  try {
    if (!req.user) {
      console.error("No user logged in.");
      return res.redirect("/login");
    }
    const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
    if(!cart){
      console.log();
      
      return res.render('cart', {
        cart: { items: [] },
        summary: { originalPrice: 0, savings: 0, storePickup: 0, tax: 0, total: 0 },
        relatedProduct:[], user: req.user,
      });
    }
    const originalPrice = cart.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const savings = 0;
    const storePickup = 99;
    const tax = originalPrice * 0.1;
    const total = originalPrice - savings + storePickup + tax;
    
    const summary = { originalPrice, savings, storePickup, tax, total };
    let relatedProduct=[]
    if(cart.items.length>0&&cart.items[0].productId){
      const cartProductIds=cart.items.map(item=>item.productId._id)
     
      relatedProduct = await Product.find({
        category: cart.items[0].productId.category,
        _id: { $nin: cartProductIds }
      }).limit(4);
    }
    console.log('cart log', req.user);
    
    res.render('cart', { cart, summary,user:req.user,relatedProduct:relatedProduct });
  } catch (error) {
    console.error('Error fetching Cart', error);
    res.status(500).send("Internal server Error");
  }
};

const addToCart = async (req, res) => {
  console.log('addToCart route is called');
  try {
    const { productId, quantity } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
  
    const qty = parseInt(quantity, 10) || 1;
    const maxLimit = 10; 
  
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
        price: product.salePrice
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
          select: 'productName productImages regularPrice salePrice'
        });
  
      if (!cart || !cart.items || cart.items.length === 0) {
        return res.redirect('/cart');
      }
  
      const user = await User.findById(userId);
  
      // Find the address document for the user
      const addressDocument = await Address.find({ userId: userId }).lean();
      
      const addresses = addressDocument.reduce((acc,doc)=>{
        return acc.concat(doc.address)
      },[])
  
      let summary = {
        originalPrice: 0,
        finalPrice: 0,
        storePickup: 99,
        tax: 0,
        total: 0
      };
  
      cart.items.forEach(item => {
        summary.originalPrice += item.price * item.quantity;
      });
  
      summary.finalPrice = summary.originalPrice;
      summary.tax = summary.finalPrice * 0.1;
      summary.total = summary.finalPrice + summary.tax + summary.storePickup;
      
      
  
      res.render('checkOut', {
        cart,
        user,
        addresses,
        summary,
        title: 'Checkout'
      });

    } catch (error) {
      console.error('CheckOut error:', error);
      res.redirect('/cart');
    }
  }

  
  const placeOrder = async (req, res) => {
    try {
      if (!req.user || !req.user._id) {
        return res.status(401).json({ error: "User not authenticated" });
      }
  
      const userId = req.user._id;
      const { addressId, totalPrice, discount, finalAmount, status, couponApplied } = req.body;
  
      const cart = await Cart.findOne({ userId }).populate('items.productId');
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ error: "Your cart is empty. Please add products before placing an order." });
      }
      
  
      // Check stock availability
      for (let item of cart.items) {
        const product = await Product.findById(item.productId._id);
        if (!product || product.quantity < item.quantity) {
          return res.status(400).json({ error: `Not enough stock for ${product.productName}` });
        }
      }
  
      const orderedItems = cart.items.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.price
      }));
  
      const newOrder = new Order({
        userId,
        orderedItems,
        totalPrice,
        discount,
        finalAmount,
        address: addressId,
        status,
        couponApplied,
        invoiceDate: new Date()
      });
  
      await newOrder.save();
  
      // Reduce stock for each product
      for (let item of cart.items) {
        await Product.findByIdAndUpdate(item.productId._id, { $inc: { quantity: -item.quantity } });
      }
  
      // Clear the cart from the database
      await Cart.deleteOne({ userId });
  
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
  

module.exports = { getCart, addToCart,updateCart,removeItem,checkOut ,placeOrder};
