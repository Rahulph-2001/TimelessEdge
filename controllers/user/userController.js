const User = require('../../models/userSchema');
const Category=require('../../models/categorySchema')
const Product=require('../../models/productSchema')
const Brand=require('../../models/brandSchema')
const express = require('express');
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
};

const loadShopping = async (req, res) => {
    try {
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isBlocked: false });

        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;
        const currentPage = page; 
        // Build query object
        let query = { isBlocked: false, quantity: { $gt: 0 } };

        // Add price filter if present in query params
        if (req.query.minPrice && req.query.maxPrice) {
            query.salePrice = {
                $gte: parseInt(req.query.minPrice),
                $lte: parseInt(req.query.maxPrice)
            };
        }

        const totalProducts = await Product.countDocuments(query);

        const products = await Product.find(query)
            .populate('category')
            .populate('brand')
            .skip(skip)
            .limit(limit)
            .sort({ createdOn: -1 });

        // const processedProducts = products.map(product => ({
        //     ...product._doc,
        //     image: product.productImages && product.productImages.length > 0 
        //         ? product.productImages[0] 
        //         : '/img/default-product.jpg'
        // }));
        const processedProducts = products.map(product => ({
            ...product._doc,
            image: product.productImages && product.productImages.length > 0 
                ? product.productImages[0] 
                : '/img/default-product.jpg'
        }));
        
        
        const totalPages = Math.ceil(totalProducts / limit);

        // return res.render('shop', {
        //     products: processedProducts,
        //     categories: categories,
        //     brands: brands,
        //     currentPage: page,
        //     totalPages: totalPages,
        //     user: req.session.user || null
        // });
        res.render('shop', {
            user: req.session.user || null,
            products: processedProducts,  // ✅ Fixed
            categories: categories,
            brands: brands,
            totalPages,
            currentPage
        });
        
        
    } catch (error) {
        console.error('Error loading shopping page:', error);
        res.status(500).send('Server Error');
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

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.render('signup', { message: "Failed to send verification email" });
        }

        req.session.userOtp = otp;
        req.session.userData = { 
            name, phone, email, password 
        };
        console.log("OTP",otp)

        return res.render("verify-otp");
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
            req.session.userOtp = null
            res.json({success: true});
           
        } else {
            res.status(400).json({failed: "Invalid OTP, Please Try again"});
        }
    } catch(error) {
        console.error("Error Verifying OTP", error);
        res.status(500).json({success: false, message: 'An error Occurred'});
    }
}
const resendOtp=async(req,res)=>{
    try {
        const {email}=req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }
        req.session.userOtp = null;
        const otp=generateOtp()
        req.session.userOtp=otp
        const emailSend=await sendVerificationEmail(email,otp)
        if(emailSend){
            console.log("Resend OTP:",otp)
            res.status(200).json({success:true,message:"OTP Resend Successfully"})
        }else{
            res.status(500).json({success:false,message:"Failed to Resend OTP,Please Try Again"})
        }
        
    } catch (error) {
        console.error("Error Resending OTP",error)
        res.status(500).json({success:false,message:"Internal server Error.Please try again"})
    }
}
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

        let query = { isBlocked: false, quantity: { $gt: 0 } };

        if (req.query.category) {
            query.category = req.query.category;
        }

        if (req.query.brand) {
            query.brand = req.query.brand;
        }

        if (req.query.priceRange) {
            const [minPrice, maxPrice] = req.query.priceRange.split('-').map(Number);
            query.salePrice = {
                $gte: minPrice,
                $lte: maxPrice
            };
        }

        if (req.query.search) {
            query.$or = [
                { productName: { $regex: req.query.search, $options: 'i' } },
                { description: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        let products = await Product.find(query)
            .populate('category')
            .populate('brand')
            .skip(skip)
            .limit(limit)
            .sort({ createdOn: -1 })
            .lean();

        products = products.map(product => ({
            ...product,
            image: product.productImages && product.productImages.length > 0 
                ? product.productImages[0] 
                : '/img/default-product.jpg'
        }));

        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isBlocked: false });

        if (user) {
            const userData = await User.findById(user._id);
            if (userData && userData.searchhistory) {
                const searchEntry = {
                    category: req.query.category || null,
                    brand: req.query.brand || null,
                    searchOn: new Date()
                };
                userData.searchhistory.push(searchEntry);
                await userData.save();
            }
        }

        res.render('shop', {
            user: user || null,
            products: products,
            categories: categories,
            brands: brands,
            totalPages,
            currentPage: page,
            query: req.query,
            selectedCategory: req.query.category || null,
            selectedBrand: req.query.brand || null,
            selectedPriceRange: req.query.priceRange || null
        });

    } catch (error) {
        console.error("Error in filterProduct:", error);
        res.redirect('/pageNotFound');
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