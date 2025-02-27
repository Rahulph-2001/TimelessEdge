const User = require('../../models/userSchema');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const flash=require('flash')
const dotenv = require('dotenv').config();
const mongoose=require('mongoose')
const session = require('express-session');
const Brand=require('../../models/brandSchema')
const Address=require('../../models/addressSchema')
const Category=require('../../models/categorySchema')
const Order=require('../../models/orderSchema')
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
const userProfile = async (req, res) => {
    try {
        if (!req.user) {
            return res.redirect('/pageNotFound')
        }
        
        const user = await User.findById(req.user._id)
        if (!user) {
            return res.redirect('/pageNotFound')
        }
        
        const addresses = await Address.find({userId: user._id})
        
        // Collect all sub-address IDs
        const allAddressIds = [];
        addresses.forEach(doc => {
            if (doc.address && doc.address.length > 0) {
                doc.address.forEach(addr => {
                    allAddressIds.push(addr._id);
                });
            }
            // Also include the parent address ID
            allAddressIds.push(doc._id);
        });
        
        const orders = await Order.find({ address: { $in: allAddressIds } });
        
        console.log('Filtered Orders:', orders);
        
        res.render('userProfile', {user, orders, addresses})
        console.log('userdata fetched')
        
    } catch (error) {
        console.log(error, {message: "Internal server error"})
        res.status(500).send('Internal Server Error')
    }
}

const getAddAddress= async(req,res)=>{
   try {
    if(!req.user){
        return res.redirect('/login')
       
    }
    res.render('addAddress',{user:req.user})
    
   } catch (error) {
     console.error("Error rendering add render page :",error)
     req.flash('error','something went wrong .please try again')
     res.redirect('/profile#address')
   }
}


const createAddress = async (req, res) => {
    try {
        if (!req.user) {
            return res.redirect("/login");
        }
        const { adressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

        const newAddress = {
            userId: req.user._id,
            address: [{
                adressType,
                name,
                city,
                landMark,
                state,
                pincode,
                phone,
                altPhone
            }]
        };

 

        const address = new Address(newAddress);
        await address.save();
        res.redirect('/userProfile');
    } catch (error) {
        console.error("Error saving Address:", error);
        res.status(500).send("Error saving Address");
    }
};
const getEditAddress = async (req, res) => {
    try {
        if (!req.user) {
            return res.redirect("/login");
        }
        const addressDoc = await Address.findOne({ 
            userId: req.user._id, 
            "address._id": req.params.id 
        });
        if (!addressDoc) {
            return res.redirect('/userProfile');
        }
        const address = addressDoc.address.id(req.params.id);
        if (!address) {
            return res.redirect('/userProfile');
        }
        res.render('editAddress', { address, user: req.user });
    } catch (error) {
        console.error('Error fetching address for editing', error);
        res.redirect("/userProfile");
    }
};
const updateAddress = async (req, res) => {
    try {
      const { id } = req.params;
      console.log("Updating address with id:", id);
      const updateData = req.body;


      const addressDoc=await Address.findOne({
        userId:req.user._id,
        'address._id':id
      })
      if(!addressDoc){
        return res.status(404).json({message:"Address not found"})
      }
      const address=addressDoc.address.id(id)
      if(!address){
        return res.status(404).json({message:"Address not found"})

      }
      Object.keys(updateData).forEach(key=>{
        address[key]=updateData[key]
      })
      await addressDoc.save()

      res.status(200).json({message:"Address updated successfully",address:address})
  
    } catch (error) {
      console.error("Error updating address", error);
      res.status(500).json({ message: "Internal Server error" });
    }
  };
  const deleteAddress = async (req, res) => {
    try {
      const { docId, addressId } = req.params;
      
      // Find the address document
      const addressDoc = await Address.findById(docId);
      
      if (!addressDoc) {
        return res.status(404).json({ success: false, message: 'Address document not found' });
      }
      
      // Filter out the address to be deleted
      addressDoc.address = addressDoc.address.filter(
        addr => addr._id.toString() !== addressId
      );
      
      // Save the updated document
      await addressDoc.save();
      
      return res.status(200).json({ success: true, message: 'Address deleted successfully' });
    } catch (error) {
      console.error('Error deleting address:', error);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  };
  


module.exports = {
    getForgotPassPage,
    verifyForgotOtp,
    verifyForgotPassOtp,
    getResetPasspage,
    resendOtp,
    postNewPassword,
    searchProducts,
    userProfile,
    getAddAddress,
    createAddress,
    getEditAddress,
    updateAddress,
    deleteAddress
}