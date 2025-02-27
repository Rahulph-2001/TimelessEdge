const User = require('../../models/userSchema');
const Category=require('../../models/categorySchema')
const Product=require('../../models/productSchema')
const Brand=require('../../models/brandSchema')
const express = require('express');
const mongoose = require('mongoose')
const app = express();
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
        // Get categories and brands for filters
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isBlocked: false });
        
        // Pagination setup
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1) * limit;
        
        // Build query object
        let query = { isBlocked: false };
        
        // Extract query parameters
        let searchQuery = req.query.search || "";
        let priceMin = req.query.priceMin || "";
        let priceMax = req.query.priceMax || "";
        let category = req.query.category || "";
        let brand = req.query.brand || "";
        let sort = req.query.sort || "asc";
        
        console.log(`Filter values - search: "${searchQuery}", priceMin: "${priceMin}", priceMax: "${priceMax}", category: "${category}", brand: "${brand}", sort: "${sort}"`);
        
        // Search filter
        if (searchQuery) {
            query.$or = [
                { productName: { $regex: searchQuery, $options: "i" } },
                { description: { $regex: searchQuery, $options: "i" } }
            ];
        }
        
        // Price range filter
        if (priceMin && priceMax) {
            query.salePrice = {
                $gte: parseInt(priceMin),
                $lte: parseInt(priceMax)
            };
        } else if (priceMin) {
            query.salePrice = { $gte: parseInt(priceMin) };
        } else if (priceMax) {
            query.salePrice = { $lte: parseInt(priceMax) };
        }
        
        // Category filter
        if (category) {
            query.category = category;
        }
        
        // Brand filter
        if (brand) {
            query.brand = brand;
        }
        
        // Determine sort order
        let sortOption = {};
        if (sort === "asc") {
            sortOption = { productName: 1 };
        } else if (sort === "desc") {
            sortOption = { productName: -1 };
        } else if (sort === "price_low") {
            sortOption = { salePrice: 1 };
        } else if (sort === "price_high") {
            sortOption = { salePrice: -1 };
        } else if (sort === "newest") {
            sortOption = { createdOn: -1 };
        } else {
            sortOption = { productName: 1 }; // Default sort
        }
        
        console.log("MongoDB query:", JSON.stringify(query));
        console.log("Sort option:", JSON.stringify(sortOption));
        
        // Count total products for pagination
        const totalProducts = await Product.countDocuments(query);
        console.log("Total products matching query:", totalProducts);
        
        // Fetch products
        const products = await Product.find(query)
            .populate("category")
            .populate("brand")
            .skip(skip)
            .limit(limit)
            .sort(sortOption);
        
        console.log(`Found ${products.length} products for page ${page}`);
        
        // Process products for display
        const processedProducts = products.map(product => ({
            ...product._doc,
            image: product.productImages && product.productImages.length > 0 
                ? product.productImages[0] 
                : "/img/default-product.jpg"
        }));
        
        // Calculate total pages
        const totalPages = Math.ceil(totalProducts / limit);
        
        // User authentication check
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
        
        // Render shop page with all data
        res.render("shop", {
            user: activeUser || user,
            products: processedProducts,
            categories: categories,
            brands,
            totalPages,
            currentPage: page,
            itemsPerPage: limit,
            totalItems: totalProducts,
            query: { 
                search: searchQuery, 
                priceMin, 
                priceMax, 
                category,
                brand,
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
        
    
        console.log("Categories:", categories);

        let productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(cat => cat._id) }, 
            
            quantity: { $gt: 0 }
        }).populate('category');  
        console.log("Products found:", productData.length);
        console.log("Sample product:", productData[0]);

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

        if (user) {
            const userData = await User.findOne({ _id: user._id });
            res.render("home", { user: userData, products: productData });
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
        const { name, phone, email, password, cPassword } = req.body;

        if (password !== cPassword) {
            return res.render('signup', { message: "Passwords do not match" });
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("signup", { message: "User with this email already exists" });
        }

        let otp = req.session.userOtp;
        let otpTimestamp = req.session.otpTimestamp;

        if (!otp || !otpTimestamp || (Date.now() - otpTimestamp > 60000)) { // If OTP expired or not set
            otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);
            if (!emailSent) {
                return res.render('signup', { message: "Failed to send verification email" });
            }
            req.session.userOtp = otp;
            req.session.otpTimestamp = Date.now(); // Store the time OTP was generated
            req.session.userData = { name, phone, email, password };
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

const verifyOtp = async(req, res) => {
    try {
             const {otp} = req.body;
        console.log(otp);
        if(otp === req.session.userOtp) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);
            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone || undefined, 
                password: passwordHash,
                wallet: 0
              
            });
            await saveUserData.save();
            req.session.user = saveUserData._id;
            delete req.session.userOtp;
            delete req.session.userData;
            res.json({success: true});
           
        } else {
            res.status(400).json({failed: "Invalid OTP, Please Try again"});
        }
    } catch(error) {
        console.error("Error Verifying OTP", error);
        res.status(500).json({success: false, message: 'An error Occurred'});
    }
}
const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        const currentTime = Date.now();
        const lastOtpTime = req.session.otpTimestamp || 0;
        const timeElapsed = currentTime - lastOtpTime;

        if (timeElapsed < 60000) {  // Check if 60 seconds passed
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
        
        // Build query
        let query = { isBlocked: false };
        
        // Search filter
        if (req.query.search && req.query.search.trim() !== '') {
            const searchRegex = new RegExp(req.query.search.trim(), 'i');
            query.$or = [
                { productName: { $regex: searchRegex } },
                { description: { $regex: searchRegex } }
            ];
        }
        
        // Category filter
        if (req.query.category && req.query.category !== '') {
            query.category = req.query.category;
        }
        
        // Brand filter
        if (req.query.brand && req.query.brand !== '') {
            query.brand = req.query.brand;
        }
        
        // Price range filter
        if (req.query.priceMin || req.query.priceMax) {
            query.salePrice = {};
            if (req.query.priceMin) {
                query.salePrice.$gte = Number(req.query.priceMin);
            }
            if (req.query.priceMax) {
                query.salePrice.$lte = Number(req.query.priceMax);
            }
        }
        
        // Sort parameter
        let sortOption = {};
        const sort = req.query.sort || 'asc';
        if (sort === 'asc') {
            sortOption = { productName: 1 };
        } else if (sort === 'desc') {
            sortOption = { productName: -1 };
        } else {
            sortOption = { createdOn: -1 }; // Default
        }
        
        // Get total count for pagination
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);
        
        // Fetch filtered products
        const products = await Product.find(query)
            .populate('category')
            .populate('brand')
            .skip(skip)
            .limit(limit)
            .sort(sortOption);
        
        // Process products for display
        const processedProducts = products.map(product => ({
            ...product._doc,
            image: product.productImages?.length > 0 ? product.productImages[0] : "/img/default-product.jpg",
            isOutOfStock: product.quantity <= 0
        }));
        
        // Fetch categories and brands for filters
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isBlocked: false });
        
        // Render the shop page with all necessary data
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
};