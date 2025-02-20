const User = require('../../models/userSchema');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv').config();
const session = require('express-session');
const Brand=require('../../models/brandSchema')
const Category=require('../../models/categorySchema')
function generateOtp() {
    let otp = "";
    for (let i = 0; i < 6; i++) {
        otp += Math.floor(Math.random() * 10);
    }
    return otp;
}

const sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        });

        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP for Password Reset",
            text: `Your OTP is ${otp}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #007bff;">Password Reset OTP</h2>
                    <p>Your One-Time Password (OTP) for password reset is:</p>
                    <h1 style="color: #28a745; font-size: 32px; letter-spacing: 2px;">${otp}</h1>
                    <p>This OTP will expire in 1 minute.</p>
                    <p style="color: #dc3545;"><strong>Do not share this OTP with anyone.</strong></p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

const getForgotPassPage = async (req, res) => {
    try {
        if (req.session.isOtpVerified) {
            return res.redirect('/reset-password');
        }
        res.render('forgot-password', { message: '' });
    } catch (error) {
        console.error("Error in getForgotPassPage:", error);
        res.redirect("/pageNotFound");
    }
};

const verifyForgotOtp = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || !email.trim()) {
            return res.render("forgot-password", { 
                message: "Please provide an email address" 
            });
        }

        const findUser = await User.findOne({ email: email.trim().toLowerCase() });

        if (!findUser) {
            return res.render("forgot-password", { 
                message: "User with this email does not exist" 
            });
        }

        // Check if OTP was recently sent
        // const currentTime = Date.now();
        // if (req.session.otpExpiresAt && currentTime < req.session.otpExpiresAt) {
        //     return res.render("forgotPass-otp", {
        //         message: "Please use the OTP already sent to your email"
        //     });
        // }

        const currentTime = Date.now();
        if (req.session.otpExpiresAt && currentTime < req.session.otpExpiresAt) {
            const remainingTime = Math.ceil((req.session.otpExpiresAt - Date.now()) / 1000);
            return res.render("forgotPass-otp", {
                message: "Please use the OTP already sent to your email",
                remainingTime: remainingTime
            });
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
            // Store in session
            req.session.userOtp = otp;
            req.session.email = email;
            req.session.otpExpiresAt = Date.now() + 60000; // 60 seconds
            req.session.otpAttempts = 0; // Reset attempts counter

            console.log("OTP:", otp); // For development only
            const remainingTime = Math.ceil((req.session.otpExpiresAt - Date.now()) / 1000);

            return res.render('forgotPass-otp', { message: '',remainingtime:remainingTime });
        } else {
            return res.render("forgot-password", { 
                message: "Failed to send OTP. Please try again later" 
            });
        }
    } catch (error) {
        console.error("Error in verifyForgotOtp:", error);
        res.redirect('/pageNotFound');
    }
};

const verifyForgotPassOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        const currentTime = Date.now();

        // Check if session exists
        if (!req.session.userOtp || !req.session.email) {
            return res.status(400).json({ 
                success: false, 
                message: "Session expired. Please restart the password reset process." 
            });
        }

        // Check OTP expiration
        if (currentTime > req.session.otpExpiresAt) {
            return res.status(400).json({ 
                success: false, 
                message: "OTP has expired. Please request a new one." 
            });
        }

        // Track OTP attempts
        req.session.otpAttempts = (req.session.otpAttempts || 0) + 1;
        if (req.session.otpAttempts >= 3) {
            // Clear session data after too many attempts
            req.session.userOtp = null;
            req.session.otpExpiresAt = null;
            req.session.otpAttempts = 0;
            
            return res.status(400).json({ 
                success: false, 
                message: "Too many invalid attempts. Please request a new OTP." 
            });
        }

        if (enteredOtp === req.session.userOtp) {
            // Mark OTP as verified
            req.session.isOtpVerified = true;
            req.session.userOtp = null;
            req.session.otpExpiresAt = null;
            req.session.otpAttempts = 0;
            
            return res.json({ 
                success: true,
                message: "OTP verified successfully",
                redirectUrl: '/reset-password'
            });
        } else {
            return res.json({ 
                success: false, 
                message: `Invalid OTP. ${3 - req.session.otpAttempts} attempts remaining.` 
            });
        }
    } catch (error) {
        console.error("Error in verifyForgotPassOtp:", error);
        return res.status(500).json({ 
            success: false, 
            message: "An error occurred. Please try again." 
        });
    }
};

const getResetPasspage = async (req, res) => {
    try {
        // Verify that OTP was validated
        if (!req.session.isOtpVerified || !req.session.email) {
            return res.redirect('/forgot-password');
        }
        res.render("reset-password", { email: req.session.email });
    } catch (error) {
        console.error("Error in getResetPasspage:", error);
        res.redirect('/pageNotFound');
    }
};


const securePassword=async(password)=>{
    try {
        const passwordHash=await bcrypt.hash(password,10)
          return passwordHash
    } catch (error) {
        console.error("Error hashing password:", error);
    }
}

const resendOtp = async (req, res) => {
    try {
        const email = req.session.email;
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: "Session expired. Please restart the password reset process." 
            });
        }

        const currentTime = Date.now();
        if (req.session.otpExpiresAt && currentTime < req.session.otpExpiresAt) {
            const remainingTime = Math.ceil((req.session.otpExpiresAt - currentTime) / 1000);
            return res.status(400).json({
                success: false,
                message: `Please wait ${remainingTime} seconds before requesting a new OTP.`
            });
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
            req.session.userOtp = otp;
            req.session.otpExpiresAt = Date.now() + 60000;
            req.session.otpAttempts = 0;
            
            console.log("Resent OTP:", otp); // For development only
            
            return res.json({ 
                success: true,
                message: "New OTP sent successfully"
            });
        } else {
            return res.status(500).json({ 
                success: false, 
                message: "Failed to send OTP. Please try again." 
            });
        }
    } catch (error) {
        console.error("Error in resendOtp:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Internal server error" 
        });
    }
};

const postNewPassword=async(req,res)=>{
    try {
       const {newPass1,newPass2}=req.body
       const email=req.session.email;
       if(newPass1===newPass2){
        const passwordHash = await securePassword(newPass1)
        await User.updateOne({email:email},{$set:{password:passwordHash}})
        res.redirect('/login')
       }else{
        res.render("reset-password",{message:"Password do not match"})
       }
    } catch (error) {
      res.redirect("/pageNotFound");  
    }
}


const searchProducts=async (req,res)=>{
    try {
        const user=req.session.user;
        const userData=await User.findOne({_id:user})
        let search=req.body.query;


        const brands=await Brand.find({}).lean();
        const catagories=await Category.find({isListed:true}).lean()
        const categoryIds=catagories.map(category=>category._id.toString())
        let searchResult=[]
        if(req.session.filteredProducts&&req.session.filteredProducts.length>0){
            searchResult=req.session.filteredProduct.filter(product=>product.productName.toLowerCase().includes(search.toLowerCase()))
        }else{
            searchResult=await Product.find({
                productName:{$regex:".*"+search+".*",$options:"i"},
                isBlocked:false,
                quantity:{$gt:0},
                category:{$in:categoryIds}
            })
        }
        searchResult.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn))
        let itemsPerPage=6
        let currentPage=parseInt(req.query.page)||1
        let startIndex=(currentPage-1)*itemsPerPage
        let endIndex=startIndex+itemsPerPage
        let totalPages=Math.ceil(searchResult.length/itemsPerPage)
        const currentProduct=searchResult.slice(startIndex,endIndex)
        res.render('shop',{
            user:userData,
            products:currentProduct,
            catagory:catagories,
            brand:brands,
            totalPages,
            currentPage,
            count:searchResult.length,



        })
    } catch (error) {
       console.log('Error',error);
       res.redirect('/pageNotfound') 
    }

}

const userProfile=async(req,res)=>{
    try {
        const user=await User.findById(req.user._id)
        console.log('userdata fetched')
        if(!user){
            res.redirect('/pageNotFound')
        }
        res.render('userProfile',{user})
        
    } catch (error) {
        console.log(error,{message:"Internal server error"})
    }
}

module.exports = {
    getForgotPassPage,
    verifyForgotOtp,
    verifyForgotPassOtp,
    getResetPasspage,
    resendOtp,
    postNewPassword,
    searchProducts,
    userProfile
};