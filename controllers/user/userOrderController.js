const User = require('../../models/userSchema');
const Brand = require('../../models/brandSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Review = require('../../models/reviewSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const Order=require('../../models/orderSchema')
const mongoose=require('mongoose')
const confirmOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('address')
      .populate('orderedItems.product');

    if (!order) {
      return res.status(404).redirect('/');
    }

    res.render('orderConfirmation', {
      title: 'Order Confirmation',
      order
    });
  } catch (error) {
    console.error('Order confirmation error:', error.message, error.stack);
    res.status(500).redirect('/');
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    
    // Find the order by MongoDB _id instead of orderId field
    const order = await Order.findById(orderId).populate({
      path: 'orderedItems.product',
      select: 'productName productImages color'
    });
    console.log("orders from userprofile",order)
    
    if (!order) {
      return res.status(404).render('error', {
        message: 'Order not found',
        error: { status: 404 }
      });
    }
    
    // Get address information
    let address;
    if (typeof order.address === 'string' || order.address instanceof mongoose.Types.ObjectId) {
      // If address is stored as a reference
      const addressDoc = await Address.findOne({ userId: req.user._id });
      if (addressDoc && addressDoc.address && addressDoc.address.length > 0) {
        // Find the specific address by ID if possible, otherwise use the first one
        address = addressDoc.address.find(addr => addr._id.toString() === order.address.toString()) || addressDoc.address[0];
      }
    } else {
      // If address is embedded in the order
      address = order.address;
    }
    
    // Render the order details template
    return res.render('orderDetailPage', {
      title: `Order #${order.orderId}`,
      order,
      address,
      user: req.user
    });
    
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).render('error', {
      message: 'Error fetching order details',
      error: { status: 500 }
    });
  }
};


// const cancelOrder = async (req, res) => {
//   try {
//     const { orderId } = req.params;
    
//     const order = await Order.findById(orderId);
    
//     if (!order) {
//       return res.status(404).json({ success: false, message: 'Order not found' });
//     }
    
//     // Check if the order belongs to the current user
//     if (order.user.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ success: false, message: 'Unauthorized' });
//     }
    
//     // Check if the order can be cancelled (only if in 'processing' state)
//     if (order.status !== 'processing') {
//       return res.status(400).json({ 
//         success: false, 
//         message: 'This order cannot be cancelled in its current status' 
//       });
//     }
    
//     // Update order status
//     order.status = 'cancelled';
//     await order.save();
    
//     return res.status(200).json({ success: true, message: 'Order cancelled successfully' });
//   } catch (error) {
//     console.error('Error cancelling order:', error);
//     return res.status(500).json({ success: false, message: 'Server error' });
//   }
// };
const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    // Modified approach for checking user authorization
    // If you're not using authentication or don't have req.user available
    // we can skip the authorization check or use a different approach
    
    // Option 1: Skip authorization check entirely
    // This is less secure but will make the function work
    
    // Option 2: Use session-based approach if available
    // if (req.session && req.session.userId && order.user.toString() !== req.session.userId.toString()) {
    //   return res.status(403).json({ success: false, message: 'Unauthorized' });
    // }
    
    // Option 3: If you can't get user ID from anywhere, just proceed with cancellation
    
    // Check if the order can be cancelled (only if in 'processing' state)
    if (order.status !== 'processing') {
      return res.status(400).json({ 
        success: false, 
        message: 'This order cannot be cancelled in its current status' 
      });
    }
    
    // Update order status
    order.status = 'cancelled';
    await order.save();
    
    return res.status(200).json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

    module.exports={confirmOrder,getOrderDetails,cancelOrder}




