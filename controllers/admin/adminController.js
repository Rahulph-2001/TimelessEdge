const User=require("../../models/userSchema")
const mongoose=require("mongoose")
const bcrypt=require("bcrypt")
const Brand = require('../../models/brandSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Review = require('../../models/reviewSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const Order=require('../../models/orderSchema')
const Wallet=require('../../models/walletSchema')
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const pageerror=async (req,res)=>{
    res.render("admin-error")
}

const loadLogin =(req,res)=>{
   if(req.session.admin){
    return res.redirect("/admin/dashboard")
   }
   res.render("admin-login",{message:null})
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email, isAdmin: true });

        if (!admin) {
            return res.redirect("/admin/login");
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);
        if (passwordMatch) {
            req.session.admin = admin._id;
            return res.redirect("/admin/dashboard");
        } else {
            return res.redirect("/admin/login");
        }
    } catch (error) {
        console.log("Login error:", error);
        return res.redirect("/pageerror");
    }
};


const getDateRange = (period) => {
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
        case 'daily':
            startDate.setDate(now.getDate() - 7);
            break;
        case 'weekly':
            startDate.setDate(now.getDate() - 28);
            break;
        case 'monthly':
            startDate.setMonth(now.getMonth() - 12);
            break;
        case 'yearly':
            startDate.setFullYear(now.getFullYear() - 5);
            break;
        default:
            startDate.setMonth(now.getMonth() - 12);
    }
    
    return { startDate, endDate: new Date() };
};
const generateLabels = (period, startDate, endDate) => {
    const labels = [];
    const current = new Date(startDate);

    switch (period) {
        case 'daily':
            while (current <= endDate) {
                labels.push(current.toLocaleDateString('en-US', { weekday: 'short' }));
                current.setDate(current.getDate() + 1);
            }
            break;
        case 'weekly':
            let weekCount = 1;
            while (current <= endDate) {
                labels.push(`Week ${weekCount}`);
                current.setDate(current.getDate() + 7);
                weekCount++;
            }
            break;
        case 'monthly':
            while (current <= endDate) {
                labels.push(current.toLocaleDateString('en-US', { month: 'short' }));
                current.setMonth(current.getMonth() + 1);
            }
            break;
        case 'yearly':
            while (current <= endDate) {
                labels.push(current.getFullYear().toString());
                current.setFullYear(current.getFullYear() + 1);
            }
            break;
    }
    return labels;
};


const loadDashboard = async (req, res) => {
    try {
        const timeFilter = req.query.timeFilter || 'monthly';
        const { startDate, endDate } = getDateRange(timeFilter);

        const ordersData = await getOrdersData(timeFilter, startDate, endDate);
        const topProducts = await getTopProducts();
        const topCategories = await getTopCategories();
        const topBrands = await getTopBrands();

        const ordersStats = await Order.aggregate([
            { $match: { createdOn: { $gte: startDate, $lte: endDate }, status: { $nin: ['Cancelled', 'Returned'] } } },
            { $group: { _id: null, totalOrders: { $sum: 1 }, revenue: { $sum: '$finalAmount' } } }
        ]);
        console.log(ordersStats)

        const totalOrders = ordersStats[0]?.totalOrders || 0;
       
        const revenue = ordersStats[0]?.revenue || 0;
        const avgOrderValue = totalOrders > 0 ? Math.round(revenue / totalOrders) : 0;

        res.render('dashboard', {
            title: 'Admin Dashboard',
            totalOrders,
            revenue,
            avgOrderValue,
            ordersData,
            topProducts,
            topCategories,
            topBrands
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.redirect('/pageerror');
    }
};

const getOrdersDataAPI = async (req, res) => {
    try {
        const timeFilter = req.query.timeFilter || 'monthly';
        const { startDate, endDate } = getDateRange(timeFilter);
        const ordersData = await getOrdersData(timeFilter, startDate, endDate);
        res.json(ordersData);
    } catch (error) {
        console.error('Error fetching orders data:', error);
        res.status(500).json({ message: 'Error fetching data' });
    }
};

const getLedgerDataAPI = async (req, res) => {
    try {
        const dateRange = req.query.dateRange || '30';
        const days = dateRange === 'all' ? Infinity : parseInt(dateRange);
        const startDate = days === Infinity ? new Date(0) : new Date(new Date().setDate(new Date().getDate() - days));

        const ledgerStats = await Order.aggregate([
            { $match: { createdOn: { $gte: startDate }, status: { $nin: ['Cancelled', 'Returned'] } } },
            { $group: { _id: null, revenue: { $sum: '$finalAmount' } } }
        ]);

        const revenue = ledgerStats[0]?.revenue || 0;
        const expenses = 0;
        const profit = revenue - expenses;

        res.json({ revenue, expenses, profit });
    } catch (error) {
        console.error('Error fetching ledger data:', error);
        res.status(500).json({ message: 'Error fetching ledger data' });
    }
};

async function getOrdersData(period, startDate, endDate) {
    const labels = generateLabels(period, startDate, endDate);
    const values = Array(labels.length).fill(0);
    
    const baseQuery = { 
        createdOn: { $gte: startDate, $lte: endDate }, 
        status: { $nin: ['Cancelled', 'Returned'] } 
    };

    try {
        if (period === 'daily') {
            const orderData = await Order.aggregate([
                { $match: baseQuery },
                { 
                    $group: { 
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdOn" } },
                        count: { $sum: 1 } 
                    } 
                },
                { $sort: { _id: 1 } }
            ]);

            orderData.forEach(item => {
                const date = new Date(item._id);
                const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
                labels.forEach((label, index) => {
                    if (label === dayOfWeek) {
                        values[index] = item.count;
                    }
                });
            });
        } 
        
        return { labels, values };
    } catch (error) {
        console.error("Error getting orders data:", error);
        return { labels, values };
    }
}

async function getTopProducts() {
    try {
        const topProducts = await Order.aggregate([
            { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
            { $unwind: '$orderedItems' },
            { $group: { _id: '$orderedItems.product', count: { $sum: '$orderedItems.quantity' } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
            { $unwind: '$product' },
            { $project: { name: '$product.productName', count: 1 } }
        ]);
        return topProducts;
    } catch (error) {
        console.error("Error getting top products:", error);
        return [];
    }
}

async function getTopCategories() {
    try {
        const topCategories = await Order.aggregate([
            { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
            { $unwind: '$orderedItems' },
            { $lookup: { from: 'products', localField: 'orderedItems.product', foreignField: '_id', as: 'product' } },
            { $unwind: '$product' },
            { $group: { _id: '$product.category', count: { $sum: '$orderedItems.quantity' } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
            { $unwind: '$category' },
            { $project: { name: '$category.name', count: 1 } }
        ]);
        return topCategories;
    } catch (error) {
        console.error("Error getting top categories:", error);
        return [];
    }
}

async function getTopBrands() {
    try {
        const topBrands = await Order.aggregate([
            { $match: { status: { $nin: ['Cancelled', 'Returned'] } } },
            { $unwind: '$orderedItems' },
            { $lookup: { from: 'products', localField: 'orderedItems.product', foreignField: '_id', as: 'product' } },
            { $unwind: '$product' },
            { $group: { _id: '$product.brand', count: { $sum: '$orderedItems.quantity' } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $lookup: { from: 'brands', localField: '_id', foreignField: '_id', as: 'brand' } },
            { $unwind: '$brand' },
            { $project: { name: '$brand.name', count: 1 } }
        ]);
        return topBrands;
    } catch (error) {
        console.error("Error getting top brands:", error);
        return [];
    }
}







const logout=async (req,res)=>{
    try {
        req.session.destroy(err=>{
            if(err){
                console.log("Error destroying session",err)
               return res.redirect("/pageerror")
            }
            res.redirect("/admin/login")
        })
    } catch (error) {
        console.log("Unexpected error during logout",error)
        res.redirect("/pageerror")
    }
}
module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
    getOrdersDataAPI,
    getLedgerDataAPI
}