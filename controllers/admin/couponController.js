const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema');
const express = require('express');
const mongoose = require("mongoose");
const Product = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema');
const Coupon = require('../../models/couponSchema');

const validateCouponData = (data) => {
    const errors = {};
    
    if (!data.couponName || !data.couponName.match(/^[A-Za-z0-9]{1,50}$/)) {
        errors.couponName = "Coupon name must be alphanumeric and 1-50 characters long";
    }
    

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isNaN(startDate.getTime())) {
        errors.startDate = "Invalid start date";
    } else if (startDate < today) {
        errors.startDate = "Start date must be today or a future date";
    }
    
    if (isNaN(endDate.getTime())) {
        errors.endDate = "Invalid end date";
    } else if (endDate <= startDate) {
        errors.endDate = "End date must be after the start date";
    }
 
    const offerPrice = parseFloat(data.offerPrice);
    const minimumPrice = parseFloat(data.minimumPrice);
    
    if (isNaN(offerPrice) || offerPrice <= 0) {
        errors.offerPrice = "Offer price must be a positive number";
    }
    
    if (isNaN(minimumPrice) || minimumPrice <= 0) {
        errors.minimumPrice = "Minimum price must be a positive number";
    }
    
    if (!isNaN(offerPrice) && !isNaN(minimumPrice) && offerPrice >= minimumPrice) {
        errors.offerPrice = "Offer price must be less than minimum price";
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

const getCoupon = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdOn: -1 });
        return res.render('couponManagement', { coupons });
    } catch (error) {
        console.error("Error getting coupons:", error);
        return res.redirect('/pageNotFound');
    }
}
const createCoupon = async (req, res) => {
    try {
        console.log("Request Body:", req.body);

        const data = {
            couponName: req.body.couponName,
            startDate: new Date(req.body.startDate + 'T00:00:00'),
            endDate: new Date(req.body.endDate + 'T00:00:00'),
            offerPrice: parseFloat(req.body.offerPrice),
            minimumPrice: parseFloat(req.body.minimumPrice)
        };

        const validation = validateCouponData(data);

        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: validation.errors
            });
        }

        const existingCoupon = await Coupon.findOne({ name: data.couponName });
        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                message: "A coupon with this name already exists"
            });
        }

        const newCoupon = new Coupon({
            name: data.couponName,
            createdOn: data.startDate,
            expireOn: data.endDate,
            offerPrice: data.offerPrice,
            minimumPrice: data.minimumPrice,
            isList: true 
        });

        await newCoupon.save();
        
     
        return res.status(201).json({
            success: true,
            message: "Coupon created successfully!",
            coupon: newCoupon
        });
    } catch (error) {
        console.error("Error creating coupon:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

const getEditCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        
        if (!mongoose.Types.ObjectId.isValid(couponId)) {
            return res.status(400).render('error', { 
                message: 'Invalid coupon ID' 
            });
        }
        
        const findCoupon = await Coupon.findOne({ _id: couponId });
        if (!findCoupon) {
            return res.status(404).render('error', { 
                message: 'Coupon not found' 
            });
        }
        
        res.render('editCoupon', { findCoupon });
    } catch (error) {
        console.error("Error editing coupon:", error);
        return res.status(500).render('error', { 
            message: 'Internal Server Error' 
        });
    }
};

const updateCoupon = async (req, res) => {
    try {
        console.log("Received update request:", req.body);

        const { couponId, couponName, startDate, endDate, offerPrice, minimumPrice } = req.body;
  
        if (!mongoose.Types.ObjectId.isValid(couponId)) {
            console.log("Invalid Coupon ID:", couponId);
            return res.status(400).json({ 
                success: false,
                message: "Invalid Coupon ID" 
            });
        }

        const data = {
            couponName: couponName?.trim(),
            startDate,
            endDate,
            offerPrice,
            minimumPrice
        };
        
        const validation = validateCouponData(data);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: validation.errors
            });
        }
        
        const existingCoupon = await Coupon.findOne({
            name: data.couponName,
            _id: { $ne: couponId }
        });

        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                message: "A coupon with this name already exists"
            });
        }

        const updatedCoupon = await Coupon.findByIdAndUpdate(
            couponId,
            {
                name: couponName.trim(),
                createdOn: new Date(startDate + "T00:00:00"),
                expireOn: new Date(endDate + "T00:00:00"),
                offerPrice: parseFloat(offerPrice),
                minimumPrice: parseFloat(minimumPrice),
            },
            { 
                new: true,
                runValidators: true 
            }
        );
  
        if (!updatedCoupon) {
            console.log("Coupon not found:", couponId);
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }
  
        console.log("Coupon updated successfully:", updatedCoupon);
        return res.status(200).json({ 
            success: true,
            message: "Coupon updated successfully", 
            updatedCoupon 
        });
    } catch (error) {
        console.error("Error updating coupon:", error);
        return res.status(500).json({ 
            success: false,
            message: "Internal Server Error", 
            details: error.message 
        });
    }
};

const blockCoupon=async(req,res)=>{
    try {
        const couponId=req.params.couponId
        if (!mongoose.Types.ObjectId.isValid(couponId)) {
            return res.status(400).json({ success: false, message: "Invalid Coupon ID" });
        }
        const updatedCoupon=await Coupon.findByIdAndUpdate(couponId,{isList:false},{new:true}) 
        if(!updatedCoupon){
            return res.status(404).json({success:false,message:"Coupon Not Found"})
        }
        res.status(200).json({success:true,message:"Coupon Blocked SuccessFully ",coupon:updateCoupon})
        
    } catch (error) {
        console.error("Error blocking coupon:", error);
        res.status(500).json({ success: false, message: "Failed to block coupon", error: error.message });
    }
        
    }

    const unblockCoupon=async(req,res)=>{
        try {
            const couponId=req.params.couponId
            if (!mongoose.Types.ObjectId.isValid(couponId)) {
                return res.status(400).json({ success: false, message: "Invalid Coupon ID" });
            }
            const updatedCoupon=await Coupon.findByIdAndUpdate(couponId,{isList:true},{ne:true})
            if(!updatedCoupon){
                return res.status(404).json({success:false,message:"Coupon Not Found"})
            }
            res.status(200).json({success:true,message:"Coupon Unblocked SuccessFully",coupon:updatedCoupon})

            
        } catch (error) {
            console.error('Error unblocking Coupon',error)
            res.status(500).json({success:false,message:"Failed to Unblock coupon",error:error.message})
            
        }
    }



module.exports = {
    getCoupon,
    createCoupon,
    getEditCoupon,
    updateCoupon,
    blockCoupon,
    unblockCoupon
};