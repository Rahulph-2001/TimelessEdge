const User = require('../../models/userSchema');
const Brand = require('../../models/brandSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Review = require('../../models/reviewSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const Order=require('../../models/orderSchema')
const mongoose=require('mongoose')
const Wallet=require('../../models/walletSchema')
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const confirmOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('orderedItems.product');
      console.log(order.address);
      
      const address = await Address.find(
        { "address._id": order.address },
        { "address.$": 1 }
      )
      

    if (!order) {
      return res.status(404).redirect('/');
    }
    console.log(address[0].address[0].name);
    

    res.render('orderConfirmation', {
      title: 'Order Confirmation',
      order,
      address,
    });
  } catch (error) {
    console.error('Order confirmation error:', error.message, error.stack);
    res.status(500).redirect('/');
  }
}


const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    
    const order = await Order.findById(orderId).populate({
      path: 'orderedItems.product',
      select: 'productName productImages color'
    });
    
    if (!order) {
      return res.status(404).render('error', {
        message: 'Order not found',
        error: { status: 404 }
      });
    }
    
    let address = null;
    
    try {
      if (order.address) {
        const addressDocs = await Address.find({ userId: req.user._id });
        
        for (const doc of addressDocs) {
          if (doc.address && Array.isArray(doc.address)) {
            const foundAddress = doc.address.find(addr => 
              addr._id.toString() === order.address.toString()
            );
            
            if (foundAddress) {
              address = foundAddress;
              break; 
            }
          }
        }
      }
    } catch (addrError) {
      console.error('Error finding address:', addrError);
    }
    
    if (!address) {
      address = {
        name: "Address information unavailable",
        landMark: "",
        city: "",
        state: "",
        pincode: "",
        phone: ""
      };
    }
    
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

const cancelOrder = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }
    const orderId = req.params.orderId;
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ message: "Cancellation reason is required." });
    }
    
    const addresses = await Address.find({ userId: req.user._id });
    if (!addresses || addresses.length === 0) {
      return res.status(400).json({ message: "No addresses found for user." });
    }
    const allowedAddressIds = [];
    addresses.forEach(doc => {
      if (doc.address && Array.isArray(doc.address)) {
        doc.address.forEach(addr => allowedAddressIds.push(addr._id));
      }
      allowedAddressIds.push(doc._id);
    });
    
    const order = await Order.findOne({
      _id: orderId,
      address: { $in: allowedAddressIds }
    });
    if (!order) {
      return res.status(404).json({ message: "Order not found or you are not authorized to cancel this order." });
    }
    
    if (!['pending', 'processing'].includes(order.status.toLowerCase())) {
      return res.status(400).json({ message: "This order cannot be cancelled anymore." });
    }
    
    order.status = "Cancelled";
    order.cancellationDate = new Date();
    
    order.orderedItems.forEach(item => {
      if (item.status && ['pending', 'processing'].includes(item.status.toLowerCase())) {
        item.status = "Cancelled";
      }
    });
    
    await order.save();
    res.status(200).json({ message: "Order cancelled successfully." });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


const getWalletPage = async (req, res) => {
  try {
      const userId = req.user._id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      let wallet = await Wallet.findOne({ userId });
      
      if (!wallet) {
          wallet = new Wallet({
              userId,
              walletBalance: 0,
              transactions: []
          });
          await wallet.save();
      }
      
      const totalTransactions = wallet.transactions.length;
      const totalPages = Math.ceil(totalTransactions / limit);
      
      const transactions = wallet.transactions
          .sort((a, b) => b.transactionDate - a.transactionDate)
          .slice(skip, skip + limit);
      
      res.render('Wallet', {
          title: 'My Wallet',
          walletBalance: wallet.walletBalance.toFixed(2),
          transactions,
          currentPage: page,
          totalPages,
          totalTransactions,
          limit,
          user:req.user
      });
  } catch (error) {
      console.error('Error fetching wallet:', error);
      res.redirect('/userProfile');
  }
};
const addFunds = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user._id;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.redirect('/wallet');
    }
    
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ 
        success: false, 
        message: 'Wallet not found' 
      });
    }
    
    wallet.transactions.push({
      transactionType: 'credit',
      transactionAmount: parseFloat(amount),
      transactionDate: new Date(),
      transactionStatus: 'completed'
    });
    
    await wallet.save();
    
    res.redirect('/wallet');
  } catch (error) {
    console.error('Error adding funds:', error);
    res.redirect('/wallet');
  }
};


const returnOrderItem = async (req, res) => {
  try {
    const { reason } = req.body;
    const { orderId, itemId } = req.params;
    
    if (!reason) {
      return res.status(400).json({ 
        success: false, 
        message: 'Return reason is required' 
      });
    }
    
    const addresses = await Address.find({ userId: req.user._id });
    if (!addresses || addresses.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "No addresses found for user."
      });
    }
    
    const allowedAddressIds = [];
    addresses.forEach(doc => {
      if (doc.address && Array.isArray(doc.address)) {
        doc.address.forEach(addr => allowedAddressIds.push(addr._id.toString()));
      }
      allowedAddressIds.push(doc._id.toString());
    });
    
    const order = await Order.findOne({ 
      _id: orderId,
      address: { $in: allowedAddressIds }
    }).populate('orderedItems.product');
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found or does not belong to you' 
      });
    }
    
    if (!['delivered', 'return request'].includes(order.status.toLowerCase())) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot return items for order in ${order.status} status. Only delivered orders can be returned.` 
      });
    }
    
    if (order.status.toLowerCase() === 'delivered') {
      order.status = 'Return Request';
    }
    
    const orderedItem = order.orderedItems.find(
      item => item._id.toString() === itemId
    );
    
    if (!orderedItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Item not found in this order' 
      });
    }
    if (orderedItem.status && orderedItem.status.toLowerCase() === 'return request') {
      return res.status(400).json({ 
        success: false, 
        message: 'A return request for this item already exists' 
      });
    }
    
    orderedItem.status = 'Return Request';
    orderedItem.returnReason = reason;
    orderedItem.returnRequestedOn = new Date();
    
    await order.save();
    
    res.status(200).json({ 
      success: true, 
      message: 'Return request submitted successfully' 
    });
  } catch (error) {
    console.error('Error processing return request:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid order or item ID format' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit return request. Please try again.',
      error: error.message
    });
  }
};




const downloadInvoice = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized. Please log in." 
      });
    }

    const { orderId, itemId } = req.params;

    const addresses = await Address.find({ userId: req.user._id });
    if (!addresses || addresses.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized. Please log in." 
      });
    }
    
    const allowedAddressIds = [];
    addresses.forEach(doc => {
      if (doc.address && Array.isArray(doc.address)) {
        doc.address.forEach(addr => allowedAddressIds.push(addr._id.toString()));
      }
      allowedAddressIds.push(doc._id.toString());
    });
    
    const order = await Order.findOne({ 
      _id: orderId,
      address: { $in: allowedAddressIds }
    }).populate('orderedItems.product');
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found or does not belong to you' 
      });
    }
    
    const orderedItem = order.orderedItems.find(
      item => item._id.toString() === itemId
    );
    
    if (!orderedItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Item not found in this order' 
      });
    }
    
    if (order.status.toLowerCase() !== 'delivered' && orderedItem.status?.toLowerCase() !== 'delivered') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invoice is only available for delivered items' 
      });
    }
    
    let address = null;
    for (const doc of addresses) {
      if (doc.address && Array.isArray(doc.address)) {
        const foundAddress = doc.address.find(addr => 
          addr._id.toString() === order.address.toString()
        );
        
        if (foundAddress) {
          address = foundAddress;
          break;
        }
      }
    }

    if (!address) {
      address = {
        name: "Address not available",
        landMark: "",
        city: "",
        state: "",
        pincode: "",
        phone: ""
      };
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}-${itemId}.pdf`);
    
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);
    
    doc.fontSize(20).text('TimelessEdge', { align: 'center' });
    doc.fontSize(12).text('Invoice', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(14).text('Order Details', { underline: true });
    doc.fontSize(10).text(`Order ID: ${order.orderId}`);
    doc.fontSize(10).text(`Invoice Date: ${new Date().toLocaleDateString()}`);
    doc.fontSize(10).text(`Order Date: ${new Date(order.createdOn).toLocaleDateString()}`);
    doc.moveDown();
    
    doc.fontSize(14).text('Shipping Address', { underline: true });
    doc.fontSize(10).text(`Name: ${address.name}`);
    doc.fontSize(10).text(`Address: ${address.landMark}`);
    doc.fontSize(10).text(`${address.city}, ${address.state} - ${address.pincode}`);
    doc.fontSize(10).text(`Phone: ${address.phone}`);
    doc.moveDown();
    
    doc.fontSize(14).text('Product Details', { underline: true });

    const invoiceTableTop = 350;
    doc.fontSize(10)
       .text('Item', 50, invoiceTableTop)
       .text('Quantity', 280, invoiceTableTop)
       .text('Unit Price', 350, invoiceTableTop)
       .text('Amount', 450, invoiceTableTop);
    
    doc.moveTo(50, invoiceTableTop + 15)
       .lineTo(550, invoiceTableTop + 15)
       .stroke();
    
    const product = orderedItem.product;
    const position = invoiceTableTop + 25;

    const unitPrice = parseFloat(orderedItem.price).toFixed(2);
    const amount = parseFloat(orderedItem.price * orderedItem.quantity).toFixed(2);

    doc.fontSize(10)
       .text(product.productName, 50, position)
       .text(orderedItem.quantity.toString(), 280, position)
       .text(`₹${unitPrice}`, 350, position)
       .text(`₹${amount}`, 450, position);
    
    doc.moveTo(50, position + 20)
       .lineTo(550, position + 20)
       .stroke();
    
const itemSubtotal = orderedItem.price * orderedItem.quantity;
const itemProportion = itemSubtotal / order.totalPrice; 
const itemDiscount = order.discount * itemProportion;

const itemTotal = itemSubtotal - itemDiscount;

doc.fontSize(10)
   .text('Subtotal:', 350, position + 30)
   .text(`₹${itemSubtotal.toFixed(2)}`, 450, position + 30);

if (order.discount > 0) {
  doc.fontSize(10)
     .text('Discount:', 350, position + 50)
     .text(`- ₹${itemDiscount.toFixed(2)}`, 450, position + 50);

  doc.fontSize(10)
     .text('Total:', 350, position + 70)
     .text(`₹${itemTotal.toFixed(2)}`, 450, position + 70);
} else {
  doc.fontSize(10)
     .text('Total:', 350, position + 50)
     .text(`₹${itemTotal.toFixed(2)}`, 450, position + 50);
}

    doc.fontSize(10)
       .text('Thank you for your purchase!', 50, 700, { align: 'center' });
    
    doc.end();
    
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate invoice. Please try again.',
      error: error.message
    });
  }
}


    module.exports={confirmOrder,getOrderDetails,cancelOrder,getWalletPage,addFunds,returnOrderItem,downloadInvoice}




