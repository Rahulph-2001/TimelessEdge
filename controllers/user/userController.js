const User = require('../../models/userSchema');
const Category=require('../../models/categorySchema')
const Product=require('../../models/productSchema')
const Brand=require('../../models/brandSchema')
const express = require('express');
const mongoose = require('mongoose')
const app = express();
const Coupon=require('../../models/couponSchema')
const Cart=require('../../models/cartSchema')
const ReferralTransaction=require('../../models/refferalSchema')
const session = require('express-session');
const nodemailer = require('nodemailer');
const bcrypt=require('bcrypt')
require('dotenv').config();

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));




function generateOtp() {
    
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
    try {
        


        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });

       

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: 'Verify Your Account',
            text: `Your OTP is: ${otp}`,
            html: `<b>Your OTP: ${otp}</b>`
        });

        
        return info.accepted.length > 0;
    } catch (error) {
        console.error('Detailed email error:', error);
        return false;
    }
}


const loadSignup = async (req, res) => {
    try {
        return res.render('signup');
    } catch (error) {
        console.error('Error loading signup page:', error);
        res.status(500).send('Server Error');
    }
}




const loadShopping = async (req, res) => {
    try {
        const blockedBrands = await Brand.find({ isBlocked: true }).select('_id');
        const categories = await Category.find({ isListed: true });

        const page = Math.max(parseInt(req.query.page) || 1, 1); 
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page - 1) * limit;

        const listedCategories = categories.map(cat => cat._id);

        let query = {
            isBlocked: false,
            category: { $in: listedCategories },
            brand: { $nin: blockedBrands.map(brand => brand._id) }
        };

        let searchQuery = req.query.search ? req.query.search.trim() : "";
        let priceMin = req.query.priceMin ? parseInt(req.query.priceMin) : null;
        let priceMax = req.query.priceMax ? parseInt(req.query.priceMax) : null;
        let categoryId = req.query.category ? req.query.category.trim() : "";
        let brandId = req.query.brand ? req.query.brand.trim() : "";
        let sort = req.query.sort || "asc";

        if (searchQuery) {
            query.$or = [
                { productName: { $regex: searchQuery, $options: "i" } },
                { description: { $regex: searchQuery, $options: "i" } }
            ];
        }

        if (priceMin !== null && priceMax !== null) {
            query.salePrice = {
                $gte: priceMin,
                $lte: priceMax
            };
        } else if (priceMin !== null) {
            query.salePrice = { $gte: priceMin };
        } else if (priceMax !== null) {
            query.salePrice = { $lte: priceMax };
        }

        if (categoryId) {
            if (mongoose.Types.ObjectId.isValid(categoryId)) {
                const isCategoryListed = listedCategories.some(id => id.toString() === categoryId);
                if (isCategoryListed) {
                    query.category = categoryId;
                }
            }
        }

        if (brandId) {
            if (mongoose.Types.ObjectId.isValid(brandId)) {
                if (!blockedBrands.map(b => b._id.toString()).includes(brandId)) {
                    query.brand = brandId;
                }
            }
        }

        let sortOption = {};
        switch (sort) {
            case "desc":
                sortOption = { productName: -1 };
                break;
            case "price_low":
                sortOption = { salePrice: 1 };
                break;
            case "price_high":
                sortOption = { salePrice: -1 };
                break;
            case "newest":
                sortOption = { createdAt: -1 };
                break;
            case "asc":
            default:
                sortOption = { productName: 1 };
                break;
        }

        const totalProducts = await Product.countDocuments(query);

        if (totalProducts === 0) {
            const brands = await Brand.find({ isBlocked: false });
            return res.render("shop", {
                user: null,
                products: [],
                categories,
                brands,
                totalPages: 0,
                currentPage: page,
                itemsPerPage: limit,
                totalItems: 0,
                query: {
                    search: searchQuery,
                    priceMin: priceMin || '',
                    priceMax: priceMax || '',
                    category: categoryId,
                    brand: brandId,
                    sort
                }
            });
        }

        const totalPages = Math.ceil(totalProducts / limit);
        
        const adjustedPage = page > totalPages ? 1 : page;
        const adjustedSkip = (adjustedPage - 1) * limit;

        const products = await Product.find(query)
            .populate("category")
            .populate("brand")
            .skip(adjustedSkip)
            .limit(limit)
            .sort(sortOption)
            .lean(); 

        const processedProducts = products.map(product => {
            const categoryOffer = product.category ? product.category.categoryOffer || 0 : 0;
            
            const productOffer = product.productOffer || 0;
            
            const bestOffer = Math.max(categoryOffer, productOffer);
            
            let finalPrice = product.salePrice;
            let offerPrice = null;
            let savedAmount = null;
            let offerType = null;
            
            if (bestOffer > 0) {
                offerPrice = Math.round(product.salePrice * (1 - bestOffer/100));
                savedAmount = product.salePrice - offerPrice;
                offerType = productOffer > categoryOffer ? 'product' : 'category';
            }
            
            return {
                ...product,
                image: product.productImages && product.productImages.length > 0
                    ? product.productImages[0]
                    : "/img/default-product.jpg",
                categoryOffer,
                productOffer,
                bestOffer,
                offerPrice,
                savedAmount,
                offerType
            };
        });

        const user = req.session.user || null;
        const userId = user ? user._id : null;

        let activeUser = null;
        if (userId) {
            activeUser = await User.findById(userId);

            if (!activeUser || activeUser.isBlocked) {
                req.session.destroy();
                return res.redirect('/login');
            }
        }

        const brands = await Brand.find({ isBlocked: false });

        res.render("shop", {
            user: activeUser || user,
            products: processedProducts,
            categories,
            brands,
            totalPages,
            currentPage: adjustedPage,
            itemsPerPage: limit,
            totalItems: totalProducts,
            query: {
                search: searchQuery,
                priceMin: priceMin || '',
                priceMax: priceMax || '',
                category: categoryId,
                brand: brandId,
                sort
            }
        });
    } catch (error) {
        console.error("Error loading shopping page:", error);
        res.status(500).send("Server Error");
    }
};

const loadHomepage = async (req, res) => {
    try {
        const user = req.session.user;
        const categories = await Category.find({ isListed: true }) || [];
        
    
        let productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(cat => cat._id) }, 
            
            quantity: { $gt: 0 }
        }).populate('category');  
        

        productData = productData.map(product => {
            let imageUrl = product.productImages && product.productImages.length > 0 
                ? product.productImages[0]  
                : '/img/default-product.jpg';
            return {
                ...product._doc,
                image: imageUrl
            };
        });
        
        

        productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        productData = productData.slice(0, 4);
        let cart 

        if (user) {
            const userData = await User.findOne({ _id: user._id });
            res.render("home", { user: userData, products: productData , cart: cart });
        } else {
            return res.render("home", { products: productData });
        }
        
    } catch (error) {
        console.error('Error rendering homepage:', error.message);
        console.error('Stack trace:', error.stack);
        res.status(500).send('Server Error');
    }
};
const pageNotFound = async (req, res) => {
    try {
        return res.render('page-404');
    } catch (error) {
        console.error('Error loading 404 page:', error);
        res.status(500).send('Server Error');
    }
};

const signup = async (req, res) => {
    try {
        const { name, phone, email, password, cPassword, referralCode } = req.body;

        if (password !== cPassword) {
            return res.render('signup', { message: "Passwords do not match" });
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("signup", { message: "User with this email already exists" });
        }

        let otp = req.session.userOtp;
        let otpTimestamp = req.session.otpTimestamp;

        if (!otp || !otpTimestamp || (Date.now() - otpTimestamp > 60000)) { 
            otp = generateOtp(); 
            const emailSent = await sendVerificationEmail(email, otp); 
            if (!emailSent) {
                return res.render('signup', { message: "Failed to send verification email" });
            }
            req.session.userOtp = otp;
            req.session.otpTimestamp = Date.now(); 
            req.session.userData = { name, phone, email, password, referralCode };
        }

        console.log("OTP:", otp, "Generated at:", req.session.otpTimestamp);
        return res.render("verify-otp", { otpTime: req.session.otpTimestamp });
    } catch (error) {
        console.error('Signup error:', error);
        return res.status(500).render('signup', { message: "An error occurred during signup" });
    }
};

const securePassword=async (password)=>{
    try {
        const passwordHash =await bcrypt.hash(password,10)
        return passwordHash
    } catch (error) {
        
    }
          
}

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        console.log('Entered OTP:', otp, 'Session OTP:', req.session.userOtp);

        if (otp !== req.session.userOtp) {
            return res.status(400).json({ failed: "Invalid OTP, Please Try again" });
        }

        const userData = req.session.userData;
        if (!userData) {
            return res.status(400).json({ failed: "Session data missing" });
        }

        const passwordHash = await securePassword(userData.password);

        const newUser = new User({
            name: userData.name,
            email: userData.email,
            phone: userData.phone || undefined,
            password: passwordHash,
            wallet: 0,
            referralCode: `REF${Date.now().toString().slice(-6)}`, 
        });

        await newUser.save();

        if (userData.referralCode) {
            const referrer = await User.findOne({ referralCode: userData.referralCode });
            if (referrer) {
                newUser.referredBy = referrer._id;
                await newUser.save();

                referrer.referralCount = (referrer.referralCount || 0) + 1;
                await referrer.save();

                
                const referralTransaction = new ReferralTransaction({
                    referrer: referrer._id,
                    referred: newUser._id,  
                    reward: 100,
                    status: 'pending'
                });
                await referralTransaction.save();

               
                const couponCode = `REF${referrer.referralCode}${Date.now().toString().slice(-4)}`;
                const newCoupon = new Coupon({
                    name: couponCode,
                    userId: [referrer._id], 
                    referrer: referrer._id,
                    referred: newUser._id,
                    createdOn: new Date(),
                    expireOn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 
                    offerPrice: 100,
                    minimumPrice: 500,
                    isList: false
                });
                await newCoupon.save();
            } else {
                console.log('Invalid referral code:', userData.referralCode);
            }
        }

        req.session.user = newUser._id;
        delete req.session.userOtp;
        delete req.session.userData;

        res.json({ success: true });
    } catch (error) {
        console.error("Error Verifying OTP:", error);
        res.status(500).json({ success: false, message: 'An error occurred during OTP verification' });
    }
};

const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        const currentTime = Date.now();
        const lastOtpTime = req.session.otpTimestamp || 0;
        const timeElapsed = currentTime - lastOtpTime;

        if (timeElapsed < 60000) {  
            return res.status(400).json({ 
                success: false, 
                message: `Please wait ${Math.ceil((60000 - timeElapsed) / 1000)} seconds before requesting a new OTP.` 
            });
        }

        const otp = generateOtp();
        req.session.userOtp = otp;
        req.session.otpTimestamp = currentTime;

        const emailSend = await sendVerificationEmail(email, otp);
        if (emailSend) {
            console.log("Resend OTP:", otp);
            res.status(200).json({ success: true, message: "OTP Resent Successfully" });
        } else {
            res.status(500).json({ success: false, message: "Failed to Resend OTP, Please Try Again" });
        }
    } catch (error) {
        console.error("Error Resending OTP", error);
        res.status(500).json({ success: false, message: "Internal Server Error. Please try again." });
    }
};

const loadLogin = async (req, res) => {
    try {
        console.log("Loading login page...");
        console.log("Session data:", req.session.user);

        if (req.session.user) {
            const userData = await User.findById(req.session.user._id);
            if (userData) {
                return res.redirect("/");
            }
        }

        return res.render("login");
    } catch (error) {
        console.log("Error loading login:", error);
        res.redirect("/pageNotFound");
    }
};


const login=async(req,res)=>{
    try {
       const{email,password}=req.body
       const findUser=await User.findOne({email:email.toLowerCase()})
       if(!findUser){
        return res.render("login",{message:"User Not Found"})
       }
       if(findUser.isBlocked){
        return res.render("login",{message:"User is Blocked by Admin"})
       }
       const passwordMatch= await bcrypt.compare(password,findUser.password)
        if(!passwordMatch){
            return res.render("login",{message:"Incorrect Password"})
        }
        req.session.user=findUser;
        res.redirect("/")
       
    } catch (error) {
      console.error("Login error")
      res.render('login',{message:"login failed.  please try again later"})  
    }
}

const logout=async(req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("Session destruction error",error.message)
                return res.redirect("/pageNotFound")
            }
            return res.redirect("/login")
        })
    } catch (error) {
        console.log("Logout error",error)
        res.redirect("/pageNotFound")
    }
}

const filterProduct = async (req, res) => {
    try {
        const user = req.session.user;
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;
        
        let query = { isBlocked: false };
        
        if (req.query.search && req.query.search.trim() !== '') {
            const searchRegex = new RegExp(req.query.search.trim(), 'i');
            query.$or = [
                { productName: { $regex: searchRegex } },
                { description: { $regex: searchRegex } }
            ];
        }
        
        if (req.query.category && req.query.category !== '') {
            query.category = req.query.category;
        }
        
        if (req.query.brand && req.query.brand !== '') {
            query.brand = req.query.brand;
        }
        
        if (req.query.priceMin || req.query.priceMax) {
            query.salePrice = {};
            if (req.query.priceMin) {
                query.salePrice.$gte = Number(req.query.priceMin);
            }
            if (req.query.priceMax) {
                query.salePrice.$lte = Number(req.query.priceMax);
            }
        }
        
        let sortOption = {};
        const sort = req.query.sort || 'asc';
        if (sort === 'asc') {
            sortOption = { productName: 1 };
        } else if (sort === 'desc') {
            sortOption = { productName: -1 };
        } else {
            sortOption = { createdOn: -1 }; 
        }
        
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);
        
        const products = await Product.find(query)
            .populate('category')
            .populate('brand')
            .skip(skip)
            .limit(limit)
            .sort(sortOption);
        
        const processedProducts = products.map(product => ({
            ...product._doc,
            image: product.productImages?.length > 0 ? product.productImages[0] : "/img/default-product.jpg",
            isOutOfStock: product.quantity <= 0
        }));
        
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isBlocked: false });
        
        res.render('shop', {
            user,
            products: processedProducts,
            categories,
            brands,
            totalPages,
            currentPage: page,
            query: {
                search: req.query.search || '',
                category: req.query.category || '',
                brand: req.query.brand || '',
                priceMin: req.query.priceMin || '',
                priceMax: req.query.priceMax || '',
                sort: sort
            }
        });
    } catch (error) {
        console.error('Filter error:', error);
        res.status(500).send('Internal server error');
    }
};

module.exports = {
    loadHomepage,
    pageNotFound,
    loadShopping,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    filterProduct
}