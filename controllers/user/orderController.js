const User = require('../../models/userSchema');
const Brand = require('../../models/brandSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Review = require('../../models/reviewSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const reviewSchema = require('../../models/reviewSchema');
const Order = require('../../models/orderSchema');

const myOrder = async(req, res) => {
    try {
        const orderId = req.params.id;

        const order = await Order.findById(orderId).populate('orderedItems.product');
        if (!order) {
            return res.redirect('/profile#orders');
        }

    
        const user = req.user || await User.findById(req.session.userId);
        
        let shippingAddress = "Address not available";
        try {
            if (typeof order.address === 'object' && order.address._id) {
                const addressData = await Address.findById(order.address);
                if (addressData) {
                    shippingAddress = `${addressData.street}, ${addressData.city}, ${addressData.state}, ${addressData.zipCode}`;
                }
            }
        } catch (err) {
            console.error('Error fetching address:', err);
        }

        const formattedOrder = {
            _id: order._id,
            orderId: order.orderId,
            createdAt: order.createdOn,
            status: order.status,
            shippingAddress: shippingAddress,
            paymentMethod: "Credit Card", 
            subtotal: order.totalPrice,
            total: order.finalAmount,
            items: order.orderedItems.map(item => ({
                _id: item._id,
                name: item.product ? item.product.name : "Product Unavailable",
                color: item.product && item.product.color ? item.product.color : "N/A",
                price: item.price,
                quantity: item.quantity,
                itemStatus: order.status, 
                Image: item.product && item.product.images ? [item.product.images[0]] : ["default-image.jpg"] 
            }))
        };

        return res.render('orderDetailPage', {
            title: 'Order Details',
            order: formattedOrder,
            user
        });

    } catch (error) {
        console.error('Error fetching order details:', error);
        return res.redirect('/profile#orders');
    }
};

module.exports = {
    myOrder
};