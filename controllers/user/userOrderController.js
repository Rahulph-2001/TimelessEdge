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
}

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
      return res.status(401).json({ 
        success: false,
        message: "Unauthorized. Please log in." 
      });
    }
    
    const orderId = req.params.orderId;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ 
        success: false,
        message: "Cancellation reason is required." 
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
        doc.address.forEach(addr => allowedAddressIds.push(addr._id));
      }
      allowedAddressIds.push(doc._id);
    });
    
    const order = await Order.findOne({
      _id: orderId,
      address: { $in: allowedAddressIds }
    });
    
    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: "Order not found or you are not authorized to cancel this order." 
      });
    }
    
    const cancellableStatuses = ['Pending', 'Processing', 'Paid'];
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({ 
        success: false,
        message: "This order cannot be cancelled anymore." 
      });
    }
    
    order.status = "Cancelled";
    order.cancellationReason = reason;
    order.cancellationDate = new Date();

    for(const item of order.orderedItems){
     item.status='Cancelled';
     item.cancellationReason=reason;
     item.cancelledAt=new Date();

     const product=await Product.findById(item.product)
    if(product){
      product.quantity +=item.quantity
      await product.save()
    }

    }

    if(order.paymentMethod==='Razorpay'&& order.finalAmount>0){
      let wallet =await Wallet.findOne({userId:req.user._id})
      if(!wallet){
        wallet =new Wallet({
          userId:req.user._id,
          walletBalance:0,
          transactions:[]
        })
      }

      const refundTransactiion={
        orderId:order._id,
        transactionType:'credit',
        transactionAmount:order.finalAmount,
        transactionDescription:`Refund for cancelled order#${order.orderId}`
      }

      wallet.transactions.push(refundTransactiion);
      await wallet.save()
    }

    await order.save()

    res.status(200).json({
      success:true,
      message:"Order cancelled successfully and refund processed to walllet if applicable"
    })

  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: error.message 
    });
  }
};

const cancelOrderItem = async (req, res) => {
  try {
      if (!req.user || !req.user._id) {
          return res.status(401).json({ 
              success: false,
              message: "Unauthorized. Please log in." 
          });
      }
      
      const { orderId, itemId } = req.params;
      const { reason } = req.body;
      
      if (!reason) {
          return res.status(400).json({ 
              success: false,
              message: "Cancellation reason is required." 
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
              doc.address.forEach(addr => allowedAddressIds.push(addr._id));
          }
          allowedAddressIds.push(doc._id);
      });
      
      const order = await Order.findOne({
          _id: orderId,
          address: { $in: allowedAddressIds }
      }).populate('orderedItems.product');
      
      if (!order) {
          return res.status(404).json({ 
              success: false,
              message: "Order not found or you are not authorized to modify this order." 
          });
      }
      
      const cancellableStatuses = ['Pending', 'Processing', 'Paid'];
      if (!cancellableStatuses.includes(order.status)) {
          return res.status(400).json({ 
              success: false,
              message: `Cannot cancel items for order in ${order.status} status.` 
          });
      }
      
      const itemIndex = order.orderedItems.findIndex(
          item => item._id.toString() === itemId
      );
      
      if (itemIndex === -1) {
          return res.status(404).json({ 
              success: false,
              message: "Item not found in this order." 
          });
      }
      
      const item = order.orderedItems[itemIndex];
      item.status = "Cancelled";
      item.cancellationReason = reason;
      item.cancelledAt = new Date();
      
    
      const product = await Product.findById(item.product);
      if (product) {
          product.quantity += item.quantity;
          await product.save();
      }
      

      if (order.paymentMethod === 'Razorpay' && order.finalAmount > 0) {
          const itemAmount = item.price * item.quantity;
          const refundAmount = itemAmount - (itemAmount / order.totalPrice * order.discount);
          
          let wallet = await Wallet.findOne({ userId: req.user._id });
          if (!wallet) {
              wallet = new Wallet({ 
                  userId: req.user._id,
                  walletBalance: 0,
                  transactions: []
              });
          }
          
          const refundTransaction = {
              orderId: order._id,
              transactionType: 'credit',
              transactionAmount: refundAmount,
              transactionDescription: `Refund for cancelled item in order #${order.orderId}`
          };
          
          wallet.transactions.push(refundTransaction);
          await wallet.save(); 
      }
      
      const allItemsCancelled = order.orderedItems.every(
          item => item.status === "Cancelled"
      );
      
      if (allItemsCancelled) {
          order.status = "Cancelled";
      }
      
      await order.save();
      
      res.status(200).json({ 
          success: true,
          message: "Item cancelled successfully and refund processed to wallet if applicable." 
      });
  } catch (error) {
      console.error("Error cancelling order item:", error);
      res.status(500).json({ 
          success: false,
          message: "Server error", 
          error: error.message 
      });
  }
};


const returnOrderItem = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please log in."
      });
    }
    
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
    
    const itemIndex = order.orderedItems.findIndex(
      item => item._id.toString() === itemId
    );
    
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in this order'
      });
    }
    
    const item = order.orderedItems[itemIndex];
    if (item.status !== 'Delivered') {
      return res.status(400).json({
        success: false,
        message: `Cannot return items that aren't delivered. Current status: ${item.status}`
      });
    }
    
    if (item.status === 'Return Request' || item.status === 'Returned') {
      return res.status(400).json({
        success: false,
        message: 'A return request for this item already exists or has been processed'
      });
    }
    
    item.status = 'Return Request';
    item.returnReason = reason;
    item.returnRequestedOn = new Date();
    
    const hasPendingItems = order.orderedItems.some(
      item => item.status !== 'Return Request' && 
              item.status !== 'Returned' && 
              item.status !== 'Cancelled'
    );
    
    if (!hasPendingItems) {
      order.status = 'Return Request';
    }
    
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'Return request submitted successfully. Please wait for approval.'
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
      message: 'Failed to process return request. Please try again.',
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
    
    const PDFDocument = require('pdfkit');
    
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
};



    module.exports={confirmOrder,getOrderDetails,cancelOrder,getWalletPage,addFunds,returnOrderItem,downloadInvoice,cancelOrderItem}




