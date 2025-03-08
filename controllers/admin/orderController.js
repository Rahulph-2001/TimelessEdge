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
            
            const matchingAddresses = await Address.find({
                "address.name": { $regex: searchTerm, $options: 'i' }
            });
            
            const addressIds = matchingAddresses.flatMap(doc => 
                doc.address.filter(addr => 
                    addr.name.toLowerCase().includes(searchTerm.toLowerCase())
                ).map(addr => addr._id)
            );
            
            const matchingProducts = await Product.find({
                productName: { $regex: searchTerm, $options: 'i' }
            });
            
            const productIds = matchingProducts.map(product => product._id);
            
            filter.$or = [
                { orderId: { $regex: searchTerm, $options: 'i' } }, 
                { address: { $in: addressIds } }, 
                { 'orderedItems.product': { $in: productIds } }, 
                { finalAmount: isNaN(parseFloat(searchTerm)) ? undefined : parseFloat(searchTerm) } 
            ].filter(Boolean);
        }
        
        const totalOrders = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / limit);
        
        const orders = await Order.find(filter)
            .populate({
                path: 'orderedItems.product',
                select: 'productName'
            })
            .sort({ createdOn: -1 }) // Newest first
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
}


const viewOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).render('admin/error', { 
                message: 'Invalid order ID format'
            });
        }
        console.log("Order ID being queried:", orderId);

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
        
        console.log("Address details:", addressDetails); 
        
        let userData = null;
        if (addressDoc) {
            userData = await User.findById(addressDoc.userId, 'name email phone');
        }
        
        console.log("User data:", userData); 
        
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



module.exports = { getAllOrders,viewOrderDetails,updateStatus,approveReturn,rejectReturn};