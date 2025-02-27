const Order = require('../../models/orderSchema');
const express = require('express');
const app = express();
const session = require('express-session');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
require('dotenv').config();

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

const AllOrder = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        
        // Count total orders for pagination
        const totalOrders = await Order.countDocuments({});
        
        const orders = await Order.find({})
            .populate({
                path: 'address',  // Updated field name; address references the User model
                select: 'username email'
            })
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit);

        // Transform orders to match template expectations if needed
        const formattedOrders = orders.map(order => ({
            _id: order.orderId, // using orderId as defined in the schema
            user: { 
                username: order.address?.username || 'Unknown' 
            },
            totalAmount: order.finalAmount || order.totalPrice,
            orderStatus: order.status, // schema field is "status"
            paymentMethod: order.paymentMethod || 'N/A', // if paymentMethod exists, otherwise defaults to N/A
            createdAt: order.invoiceDate || order.createdOn
        }));

        res.render("adminOrder", {
            orders: formattedOrders,
            currentPage: page,
            totalPages: Math.ceil(totalOrders / limit),
            totalOrders: totalOrders,
            message: req.session.message || {}
        });

        req.session.message = {};
    } catch (error) {
        console.error("Error in getting the order page:", error.message);
        // Either create an error view or use res.send for error output
        res.status(500).render("error", {
            message: "Failed to load orders",
            error: error.message
        });
    }
};

module.exports = {
    AllOrder
};
