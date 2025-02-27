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

        // You don't have userId in your schema, so we need to check ownership another way
        // For now, I'll remove this check, but you should implement a proper way to verify
        // that this order belongs to the current user
        
        // Get the user data - either from req.user or from the address
        const user = req.user || await User.findById(req.session.userId);
        
        // Try to get the shipping address
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
            paymentMethod: "Credit Card", // Update with actual payment method if available
            subtotal: order.totalPrice,
            total: order.finalAmount,
            items: order.orderedItems.map(item => ({
                _id: item._id,
                name: item.product ? item.product.name : "Product Unavailable",
                color: item.product && item.product.color ? item.product.color : "N/A",
                price: item.price,
                quantity: item.quantity,
                itemStatus: order.status, // You might want individual item status
                Image: item.product && item.product.images ? [item.product.images[0]] : ["default-image.jpg"] // Adjust based on your Product schema
            }))
        };

        return res.render('orderDetailPage', {
            title: 'Order Details',
            order: formattedOrder,
            user
        });

    } catch (error) {
        console.error('Error fetching order details:', error);
        // Only send one response - choose either redirect or JSON response, not both
        return res.redirect('/profile#orders');
    }
};

module.exports = {
    myOrder
};