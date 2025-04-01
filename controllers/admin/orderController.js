const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema')
const express = require('express');
const mongoose = require("mongoose");
const Product=require('../../models/productSchema') 
const Walllet=require('../../models/walletSchema')
const app = express();
const session = require('express-session');
const Wallet = require('../../models/walletSchema');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid'); 

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));
const getAllOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; 
        const skip = (page - 1) * limit;
        
        let filter = {};
        
    
        if (req.query.status) {
            filter.status = req.query.status;
        }
        
       
        if (req.query.startDate && req.query.endDate) {
            filter.createdOn = {
                $gte: new Date(req.query.startDate),
                $lte: new Date(new Date(req.query.endDate).setHours(23, 59, 59))
            };
        } else if (req.query.startDate) {
            filter.createdOn = { $gte: new Date(req.query.startDate) };
        } else if (req.query.endDate) {
            filter.createdOn = { $lte: new Date(new Date(req.query.endDate).setHours(23, 59, 59)) };
        }
        
        
        if (req.query.search) {
            const searchTerm = req.query.search.trim();
            
            
            filter.$or = [
                { orderId: { $regex: searchTerm, $options: 'i' } }
            ];
            
            
            const isNumeric = !isNaN(parseFloat(searchTerm));
            if (isNumeric) {
                filter.$or.push({ finalAmount: parseFloat(searchTerm) });
            }
            
            try {
               
                const matchingAddresses = await Address.find({
                    "address.name": { $regex: searchTerm, $options: 'i' }
                });
                
                if (matchingAddresses && matchingAddresses.length > 0) {
                    const addressIds = matchingAddresses.flatMap(doc => 
                        doc.address.filter(addr => 
                            addr.name.toLowerCase().includes(searchTerm.toLowerCase())
                        ).map(addr => addr._id)
                    );
                    
                    if (addressIds.length > 0) {
                        filter.$or.push({ address: { $in: addressIds } });
                    }
                }
                
               
                const matchingProducts = await Product.find({
                    productName: { $regex: searchTerm, $options: 'i' }
                });
                
                if (matchingProducts && matchingProducts.length > 0) {
                    const productIds = matchingProducts.map(product => product._id);
                    filter.$or.push({ 'orderedItems.product': { $in: productIds } });
                }
            } catch (error) {
                console.error("Error in search query:", error);
               
            }
        }
        
       
        const totalOrders = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / limit);
        
        
        const orders = await Order.find(filter)
            .populate({
                path: 'orderedItems.product',
                select: 'productName'
            })
            .sort({ createdOn: -1 }) 
            .skip(skip)
            .limit(limit);
        
       
        const ordersWithAddressDetails = await Promise.all(
            orders.map(async (order) => {
                try {
                   
                    const addressDoc = await Address.findOne({
                        "address._id": order.address
                    });
                    
                    let addressDetails = null;
                    
                    if (addressDoc && addressDoc.address && addressDoc.address.length > 0) {
                        
                        addressDetails = addressDoc.address.find(
                            addr => addr._id.toString() === order.address.toString()
                        );
                        
                       
                        if (!addressDetails && addressDoc.address.length > 0) {
                            addressDetails = addressDoc.address[0];
                        }
                    }
                    
                 
                    return {
                        ...order._doc,
                        addressDetails: addressDetails
                    };
                } catch(error) {
                    console.error(`Error fetching address for order ${order.orderId}:`, error);
                    return {
                        ...order._doc,
                        addressDetails: null
                    };
                }
            })
        );
        
        res.render('adminOrder', {
            orders: ordersWithAddressDetails,
            currentPage: page,
            totalPages,
            totalOrders,
            filters: req.query
        });
        
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).render('admin/error', { 
            message: 'Error fetching order data', 
            error 
        });
    }
};

const updateStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;

        if (!orderId || !status) {
            return res.status(400).json({ success: false, message: 'Order Id and status are required' });
        }
        
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status Value' });
        }
        
        const order = await Order.findOne({ orderId: orderId });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        const updatedOrder = await Order.findOneAndUpdate(
            { orderId: orderId },
            {
                $set: {
                    status: status,
                    ...(status === 'Delivered' ? { invoiceDate: new Date() } : {})
                }
            },
            { new: true }
        );
        
        if (status === 'Returned') {
            try {
                const addressDoc = await Address.findOne({
                    "address._id": order.address
                });
                
                if (!addressDoc) {
                    console.error("Address not found for order:", orderId);
                    return res.status(404).json({
                        success: false,
                        message: 'User address not found'
                    });
                }
                
                const userId = addressDoc.userId;
                
                for (const item of order.orderedItems) {
                    await Product.findByIdAndUpdate(
                        item.product,
                        { $inc: { quantity: item.quantity } },
                        { new: true }
                    );
                }
                
                let wallet = await Wallet.findOne({ userId: userId });
                
                if (!wallet) {
                    wallet = new Wallet({
                        userId: userId,
                        walletBalance: 0,
                        transactions: []
                    });
                }
                
                const refundAmount = order.finalAmount;
                
                wallet.transactions.push({
                    orderId: order._id,
                    transactionType: 'credit',
                    transactionAmount: refundAmount,
                    transactionDate: new Date(),
                    transactionStatus: 'completed',
                    transactionDescription: `Refund for returned order #${order.orderId}`
                });
                
                await wallet.save();
                
                await User.findByIdAndUpdate(
                    userId,
                    { $inc: { wallet: refundAmount } },
                    { new: true }
                );
                
                console.log(`Order ${orderId} returned, wallet credited with ${refundAmount}`);
            } catch (updateError) {
                console.error("Error processing return:", updateError);
                return res.status(500).json({
                    success: false,
                    message: 'Error processing return',
                    error: updateError.message
                });
            }
        }
        
        res.json({
            success: true,
            message: 'Order status updated successfully',
            order: updatedOrder
        });
        
    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({
            success: false,
            message: 'Error updating order status',
            error: error.message
        });
    }
};


const viewOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).render('admin/error', { 
                message: 'Invalid order ID format'
            });
        }

        const order = await Order.findById(orderId)
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImages price'
            });
        
        console.log("Query result:", order ? "Order found" : "No order found");
        console.log("Order data:", JSON.stringify(order, null, 2))
        
        if (!order) {
            return res.status(404).render('admin/error', { 
                message: 'Order not found'
            });
        }

        const addressDoc = await Address.findOne({
            "address._id": order.address
        });
        
        let addressDetails = null;
        
        if (addressDoc && addressDoc.address && addressDoc.address.length > 0) {
            addressDetails = addressDoc.address.find(
                addr => addr._id.toString() === order.address.toString()
            );
            
            if (!addressDetails && addressDoc.address.length > 0) {
                addressDetails = addressDoc.address[0];
            }
        }
        
        
        let userData = null;
        if (addressDoc) {
            userData = await User.findById(addressDoc.userId, 'name email phone');
        }
        
        
        res.render('viewOrderDetail', {
            order, 
            addressDetails,
            userData
        });
        
    } catch (error) {
        console.error("Error viewing order details:", error);
        res.status(500).render('admin/error', { 
            message: 'Error loading order details', 
            error 
        });
    }
}


const approveReturn=async(req,res)=>{
    try {
        const{orderId}=req.body
        if(!orderId){
            return res.status(400).json({success:false,message:"Order ID is required"})
        }
        const order=await Order.findById(orderId)

        if(!order){
            return res.status(404).json({
                success:false,
                message:'Order not found'
            })
        }


        order.status='Returned';
        await order.save()

        try{
            const addressDoc=await Address.findOne({
                'address._id':order.address
            })

            if(!addressDoc){
                return res.status(404).json({
                    success:false,
                    message:'User address not found'
                })
            }

            const userId=addressDoc.userId;


            for(const item of order.orderedItems){
                await Product.findByIdAndUpdate(item.product,
                    {$inc:{quantity:item.quantity}},
                    {new:true}
                )
            }

            let wallet=await Wallet.findOne({userId:userId})


            if(!wallet){
                wallet=new Wallet({
                    userId:userId,
                    walletBalance:0,
                    transactions:[]
                })
            }

            const refundAmount=order.finalAmount

            wallet.transactions.push({
                orderId:order._id,
                transactionType:'credit',
                transactionAmount:refundAmount,
                transactionDate:new Date(),
                transactionStatus:'completed',
                transactionDescription:`Refund for order #${order.orderId}`
            })

            await wallet.save()
            await User.findByIdAndUpdate(userId,{$inc:{wallet:refundAmount}},
                {new:true}
            )

            return res.json({
                success:true,
                message:'Return request approved and refund processed successfully',
                order:order
            })



        }catch(updateError){
            console.error("Error processing return ",updateError)
            return res.status(500).json({
                success:false,
                message:'Error processing return',
                error:updateError.message
            })
        }

    } catch (error) {
        console.error('Error approving return:',error)
        res.status(500).json({
            success:false,
            message:'Error approving return ',
            error:error.message
        })
        
    }
}

const rejectReturn=async(req,res)=>{
    try {
        const {orderId}=req.body

        if(!orderId){
            return res.status(400).json({success:false,message:'Order Id is required'})
        }
        const order =await Order.findById(orderId)

        if(!order){
            return res.status(404).json({
                success:false,
                message:'Order not Found'
            })
        }

        order.status='Delivered';
        await order.save()

        res.json({
            success:true,
            message:'Return request rejected successfully',
            order:order
        })
        
    } catch (error) {
        console.error('Error rejecting return:',error)
        res.status(500).json({
            success:false,
            message:'Error rejecting return ',
            error:error.message
        })
        
    }
}

const updateItemStatus = async (req, res) => {
    try {
        const { orderId, itemId, status } = req.body;

        if (!orderId || !itemId || !status) {
            return res.status(400).json({ 
                success: false, 
                message: 'Order Id, item Id, and status are required' 
            });
        }
        
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Returned'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid status value' 
            });
        }
        
        const order = await Order.findOne({ orderId: orderId });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        const itemIndex = order.orderedItems.findIndex(item => item._id.toString() === itemId);
        
        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Item not found in this order'
            });
        }
        
        const updateFields = {};
        updateFields[`orderedItems.${itemIndex}.status`] = status;
        
        if (status === 'Cancelled') {
            updateFields[`orderedItems.${itemIndex}.cancelledAt`] = new Date();
        } else if (status === 'Return Request') {
            updateFields[`orderedItems.${itemIndex}.returnRequestedOn`] = new Date();
        } else if (status === 'Returned') {
            updateFields[`orderedItems.${itemIndex}.returnedOn`] = new Date();
        }
        
        const updatedOrder = await Order.findOneAndUpdate(
            { orderId: orderId },
            { $set: updateFields },
            { new: true }
        ).populate({
            path: 'orderedItems.product',
            select: 'productName'
        });
        
        if (status === 'Returned') {
            try {
                const returnedItem = updatedOrder.orderedItems[itemIndex];
                
                await Product.findByIdAndUpdate(
                    returnedItem.product._id,
                    { $inc: { quantity: returnedItem.quantity } },
                    { new: true }
                );
                
                const addressDoc = await Address.findOne({
                    "address._id": order.address
                });
                
                if (!addressDoc) {
                    console.error("Address not found for order:", orderId);
                    return res.status(404).json({
                        success: false,
                        message: 'User address not found'
                    });
                }
                
                const userId = addressDoc.userId;
                
                let userWallet = await Wallet.findOne({ userId: userId });
                if (!userWallet) {
                    userWallet = new Wallet({
                        userId: userId,
                        walletBalance: 0,
                        transactions: []
                    });
                }
                
                const admin = await User.findOne({ isAdmin: true });
                if (!admin) {
                    console.error("Admin user not found");
                    return res.status(500).json({
                        success: false,
                        message: 'Error processing refund: Admin account not found'
                    });
                }
                
                let adminWallet = await Wallet.findOne({ userId: admin._id });
                if (!adminWallet) {
                    adminWallet = new Wallet({
                        userId: admin._id,
                        walletBalance: 0,
                        transactions: []
                    });
                }
                
                const refundAmount = returnedItem.price * returnedItem.quantity;
                const userTransactionId = uuidv4(); 
                const adminTransactionId = uuidv4(); 

                userWallet.transactions.push({
                    orderId: order._id,
                    itemId: returnedItem._id,
                    transactionId: userTransactionId,
                    transactionType: 'credit',
                    transactionAmount: refundAmount,
                    transactionDate: new Date(),
                    transactionStatus: 'completed',
                    transactionDescription: `Refund for returned item in order #${order.orderId}`
                });
                
                userWallet.walletBalance += refundAmount;
                await userWallet.save();
                
                adminWallet.transactions.push({
                    orderId: order._id,
                    itemId: returnedItem._id,
                    transactionId: adminTransactionId,
                    transactionType: 'debit',
                    transactionAmount: refundAmount,
                    transactionDate: new Date(),
                    transactionStatus: 'completed',
                    transactionDescription: `Refund issued for returned item in order #${order.orderId}`
                });
                
                adminWallet.walletBalance -= refundAmount;
                await adminWallet.save();
                
                await User.findByIdAndUpdate(
                    userId,
                    { $set: { wallet: userWallet.walletBalance } },
                    { new: true }
                );
                
                await User.findByIdAndUpdate(
                    admin._id,
                    { $set: { wallet: adminWallet.walletBalance } },
                    { new: true }
                );
                
                console.log(`Item in Order ${orderId} returned, user wallet credited with ${refundAmount}, admin wallet debited with ${refundAmount}`);
            } catch (updateError) {
                console.error("Error processing item return:", updateError);
                return res.status(500).json({
                    success: false,
                    message: 'Error processing item return',
                    error: updateError.message
                });
            }
        }
        
        const allItemStatuses = updatedOrder.orderedItems.map(item => item.status);
        
        let overallStatus;
        
        if (allItemStatuses.every(s => s === 'Cancelled')) {
            overallStatus = 'Cancelled';
        } else if (allItemStatuses.every(s => s === 'Returned' || s === 'Cancelled')) {
            overallStatus = 'Returned';
        } else if (allItemStatuses.some(s => s === 'Return Request')) {
            overallStatus = 'Return Request';
        } else if (allItemStatuses.every(s => s === 'Delivered' || s === 'Returned' || s === 'Cancelled')) {
            overallStatus = 'Delivered';
        } else if (allItemStatuses.some(s => s === 'Shipped')) {
            overallStatus = 'Shipped';
        } else if (allItemStatuses.some(s => s === 'Processing')) {
            overallStatus = 'Processing';
        } else {
            overallStatus = 'Pending';
        }
        
        const finalUpdatedOrder = await Order.findOneAndUpdate(
            { orderId: orderId },
            { $set: { status: overallStatus } },
            { new: true }
        );

     
        if (finalUpdatedOrder.status === 'Delivered' && finalUpdatedOrder.paymentMethod === 'COD') {
           
            const deliveredItemsTotal = finalUpdatedOrder.orderedItems
                .filter(item => item.status === 'Delivered')
                .reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            const tax = deliveredItemsTotal * 0.1;
            const shipping = 99;
            const finalDeliveredAmount = deliveredItemsTotal + tax + shipping - (finalUpdatedOrder.discount || 0);

            
            const userWallet = await Wallet.findOne({ userId: finalUpdatedOrder.userId });
            if (userWallet) {
                const userTransaction = userWallet.transactions.find(
                    t => t.orderId.toString() === finalUpdatedOrder._id.toString() && 
                         t.transactionType === 'debit' && 
                         t.transactionStatus === 'pending'
                );
                if (userTransaction) {
                    userTransaction.transactionAmount = finalDeliveredAmount;
                    userTransaction.transactionStatus = 'completed';
                    await userWallet.save();
                }
            }

            
            const admin = await User.findOne({ isAdmin: true });
            if (admin) {
                const adminWallet = await Wallet.findOne({ userId: admin._id });
                if (adminWallet) {
                    const adminTransaction = adminWallet.transactions.find(
                        t => t.orderId.toString() === finalUpdatedOrder._id.toString() && 
                             t.transactionType === 'credit' && 
                             t.transactionStatus === 'pending'
                    );
                    if (adminTransaction) {
                        adminTransaction.transactionAmount = finalDeliveredAmount;
                        adminTransaction.transactionStatus = 'completed';
                        adminWallet.walletBalance += finalDeliveredAmount;
                        await adminWallet.save();

                        await User.findByIdAndUpdate(
                            admin._id,
                            { $set: { wallet: adminWallet.walletBalance } },
                            { new: true }
                        );
                    }
                }
            }
        }
        
        res.json({
            success: true,
            message: 'Item status updated successfully',
            order: updatedOrder
        });
        
    } catch (error) {
        console.error("Error updating item status:", error);
        res.status(500).json({
            success: false,
            message: 'Error updating item status',
            error: error.message
        });
    }
};


module.exports = { getAllOrders,viewOrderDetails,updateStatus,approveReturn,rejectReturn,updateItemStatus};