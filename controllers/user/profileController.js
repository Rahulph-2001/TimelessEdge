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
const crypto = require('crypto')
const ReferralTransaction=require('../../models/refferalSchema')


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
            req.session.userOtp = otp;
            req.session.email = email;
            req.session.otpExpiresAt = Date.now() + 60000;
            req.session.otpAttempts = 0; 

            console.log("OTP:", otp); 
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

        if (!req.session.userOtp || !req.session.email) {
            return res.status(400).json({ 
                success: false, 
                message: "Session expired. Please restart the password reset process." 
            });
        }

        if (currentTime > req.session.otpExpiresAt) {
            return res.status(400).json({ 
                success: false, 
                message: "OTP has expired. Please request a new one." 
            });
        }

        req.session.otpAttempts = (req.session.otpAttempts || 0) + 1;
        if (req.session.otpAttempts >= 3) {
            req.session.userOtp = null;
            req.session.otpExpiresAt = null;
            req.session.otpAttempts = 0;
            
            return res.status(400).json({ 
                success: false, 
                message: "Too many invalid attempts. Please request a new OTP." 
            });
        }

        if (enteredOtp === req.session.userOtp) {
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
            
            console.log("Resent OTP:", otp)
            
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
        return res.redirect('/pageNotFound');
      }
  
      let user = await User.findById(req.user._id);
      if (!user) {
        return res.redirect('/pageNotFound');
      }
  
      if (!user.referralCode) {
        const timestamp = new Date().getTime().toString();
        const hash = crypto.createHash('md5').update(user.email + timestamp).digest('hex');
        user.referralCode = hash.substring(0, 8).toUpperCase();
        await user.save();
      }
  
      const addresses = await Address.find({ userId: user._id });
  
      const allAddressIds = [];
      addresses.forEach(doc => {
        if (doc.address && doc.address.length > 0) {
          doc.address.forEach(addr => {
            allAddressIds.push(addr._id);
          });
        }
        allAddressIds.push(doc._id);
      });
  
      const page = parseInt(req.query.page) || 1;
      const limit = 5;
      const skip = (page - 1) * limit;
  
      const totalOrders = await Order.countDocuments({ address: { $in: allAddressIds } });
      const totalPages = Math.ceil(totalOrders / limit);
  
      const orders = await Order.find({ address: { $in: allAddressIds } })
        .sort({ createdOn: -1 })
        .skip(skip)
        .limit(limit);
  
      const refPage = parseInt(req.query.refPage) || 1;
      const refLimit = 5;
      const refSkip = (refPage - 1) * refLimit;
  
      const totalReferrals = await ReferralTransaction.countDocuments({ referrer: user._id });
      const totalReferralPages = Math.ceil(totalReferrals / refLimit);
  
      const referralTransactions = await ReferralTransaction.find({ referrer: user._id })
        .populate('referred', 'name email')
        .sort({ createdAt: -1 })
        .skip(refSkip)
        .limit(refLimit);
  
      console.log('Referral Transactions Fetched:', referralTransactions.map(t => ({
        id: t._id,
        referrer: t.referrer,
        referred: t.referred ? t.referred.name : 'N/A',
        status: t.status,
        reward: t.reward
      })));
  
      const totalReferralEarnings = await ReferralTransaction.aggregate([
        { $match: { referrer: user._id, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$reward' } } }
      ]).then(result => result[0]?.total || 0);
  
      const referralReward = 100;
      const siteUrl = process.env.SITE_URL || 'https://yourdomain.com';
      const referralUrl = `${siteUrl}/register?ref=${user.referralCode}`;
  
      res.render('userProfile', {
        user,
        orders,
        addresses,
        referralTransactions,
        totalReferralEarnings,
        referralReward,
        siteUrl,
        pagination: {
          page,
          limit,
          totalPages,
          totalOrders
        },
        referralPagination: {
          page: refPage,
          limit: refLimit,
          totalPages: totalReferralPages,
          totalReferrals
        }
      });
    } catch (error) {
      console.error('User profile error:', error);
      res.status(500).send('Internal Server Error');
    }
  };

const getAddAddress = async (req, res) => {
    try {
      if (!req.user) {
          return res.redirect('/login');
      }
      res.render('addAddress', { user: req.user });
    } catch (error) {
      console.error("Error rendering add address page:", error);
      res.redirect('/userProfile');
    }
 };


 const createAddress = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Please login to continue' });
        }

        const { 
            addressType, 
            name, 
            city, 
            landMark, 
            state, 
            pincode, 
            phone, 
            altPhone,
            isDefault
        } = req.body;

        if (!addressType) {
            return res.status(400).json({ message: 'Address type is required' });
        }
        if (!name) {
            return res.status(400).json({ message: 'Name is required' });
        }
        if (!city) {
            return res.status(400).json({ message: 'City is required' });
        }
        if (!landMark) {
            return res.status(400).json({ message: 'Landmark is required' });
        }
        if (!state) {
            return res.status(400).json({ message: 'State is required' });
        }
        if (!pincode) {
            return res.status(400).json({ message: 'Pincode is required' });
        }
        if (!phone) {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        const namePattern = /^[a-zA-Z\s]+$/;
        const phonePattern = /^\d{10,12}$/;
        const pincodePattern = /^\d{4,8}$/;

        if (!namePattern.test(name)) {
            return res.status(400).json({ message: 'Name should only contain letters' });
        }
        if (!namePattern.test(city)) {
            return res.status(400).json({ message: 'City should only contain letters' });
        }
        if (!namePattern.test(state)) {
            return res.status(400).json({ message: 'State should only contain letters' });
        }
        if (!phonePattern.test(phone)) {
            return res.status(400).json({ message: 'Please enter a valid phone number (10-12 digits)' });
        }
        if (altPhone && !phonePattern.test(altPhone)) {
            return res.status(400).json({ message: 'Please enter a valid alternate phone number (10-12 digits)' });
        }
        if (!pincodePattern.test(pincode)) {
            return res.status(400).json({ message: 'Please enter a valid postal/zip code (4-8 digits)' });
        }

        const newAddress = {
            userId: req.user._id,
            address: [{
                adressType: addressType, 
                name,
                city,
                landMark,
                state,
                pincode,
                phone,
                altPhone: altPhone || '', 
            }]
        };

        const address = new Address(newAddress);
        await address.save();

        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(200).json({ 
                success: true, 
                message: 'Address added successfully' 
            });
        }
        
        return res.redirect('/userProfile');
        
    } catch (error) {
        console.error("Error saving Address:", error);
        
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error saving address', 
                error: error.message 
            });
        }
        
        return res.redirect('/userProfile');
    }
}
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
        if (!req.user) {
            return res.status(401).json({ message: 'Please login to continue' });
        }

        const { id } = req.params;

        const { 
            addressType,  
            name, 
            city, 
            landMark, 
            state, 
            pincode, 
            phone, 
            altPhone,
            isDefault
        } = req.body;

        if (!addressType) {
            return res.status(400).json({ message: 'Address type is required' });
        }
        if (!name) {
            return res.status(400).json({ message: 'Name is required' });
        }
        if (!city) {
            return res.status(400).json({ message: 'City is required' });
        }
        if (!landMark) {
            return res.status(400).json({ message: 'Landmark is required' });
        }
        if (!state) {
            return res.status(400).json({ message: 'State is required' });
        }
        if (!pincode) {
            return res.status(400).json({ message: 'Pincode is required' });
        }
        if (!phone) {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        const namePattern = /^[a-zA-Z\s]+$/;
        const phonePattern = /^\d{10,12}$/;
        const pincodePattern = /^\d{4,8}$/;

        if (!namePattern.test(name)) {
            return res.status(400).json({ message: 'Name should only contain letters' });
        }
        if (!namePattern.test(city)) {
            return res.status(400).json({ message: 'City should only contain letters' });
        }
        if (!namePattern.test(state)) {
            return res.status(400).json({ message: 'State should only contain letters' });
        }
        if (!phonePattern.test(phone)) {
            return res.status(400).json({ message: 'Please enter a valid phone number (10-12 digits)' });
        }
        if (altPhone && !phonePattern.test(altPhone)) {
            return res.status(400).json({ message: 'Please enter a valid alternate phone number (10-12 digits)' });
        }
        if (!pincodePattern.test(pincode)) {
            return res.status(400).json({ message: 'Please enter a valid postal/zip code (4-8 digits)' });
        }

        const addressDoc = await Address.findOne({
            userId: req.user._id,
            'address._id': id
        });
        
        if (!addressDoc) {
            return res.status(404).json({ message: "Address not found" });
        }
        
        const address = addressDoc.address.id(id);
        if (!address) {
            return res.status(404).json({ message: "Address not found" });
        }

        address.addressType = addressType;
        address.name = name;
        address.city = city;
        address.landMark = landMark;
        address.state = state;
        address.pincode = pincode;
        address.phone = phone;
        address.altPhone = altPhone || '';
        
        if (isDefault) {
            addressDoc.address.forEach(addr => {
                if (addr._id.toString() !== id) {
                    addr.isDefault = false;
                } else {
                    addr.isDefault = true;
                }
            });
        }

        await addressDoc.save();
        res.status(200).json({ 
            message: "Address updated successfully", 
            address: address 
        });
    } catch (error) {
        console.error("Error updating address", error);
        res.status(500).json({ message: "Internal Server error" });
    }
};



const blockAddress=async(req,res)=>{
    try {
        const docId = req.params.docId;
        const addressId = req.params.addressId;
        
        const addressDoc = await Address.findById(docId);
        
        if (!addressDoc) {
            return res.status(404).json({ success: false, message: 'Address document not found' });
        }
        
        const address = addressDoc.address.find(addr => addr._id.toString() === addressId);
        
        if (!address) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }
        
        address.isBlocked = !address.isBlocked;
        await addressDoc.save()
        return res.status(200).json({success:true,message:`Address ${address.isBlocked ? 'blocked':'unblocked'}successfully`})
}catch (error) {
          console.error('Error blockin address:', error);
          return res.status(500).json({ success: false, message: 'Server error' });
        }
      }


      const unblockAddress = async (req, res) => {
        try {
            const docId = req.params.docId;
            const addressId = req.params.addressId;
    
            const addressDoc = await Address.findById(docId);
    
            if (!addressDoc) {
                return res.status(404).json({ success: false, message: 'Address document not found' });
            }
    
            const address = addressDoc.address.find(addr => addr._id.toString() === addressId);
            console.log('Address to unblock:', address);
    
            if (!address) {
                return res.status(404).json({ success: false, message: 'Address not found' });
            }
    
            address.isBlocked = false;
            console.log('Address before save:', address);
            await addressDoc.save();
    
            return res.status(200).json({ success: true, message: 'Address unblocked successfully' });
        } catch (error) {
            console.error('Error unblocking address:', error);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    };

  const changeEmail=async(req,res)=>{
    try {
        res.render('change-Email')
        
    } catch (error) {
        res.redirect('/pageNotFound')
  }
}

  const changeEmailValid=async(req,res)=>{
    try {
        const {email}=req.body

        const userExists=await User.findOne({email})
        if(userExists){
         const otp=generateOtp() 
         const emailsSend=await sendVerificationEmail(email,otp)
         if(emailsSend){
            req.session.userotp=otp;
            req.session.userdata=req.body;
            req.session.email=email
            res.render('change-EmailOtp',)
            console.log("Email send",email);
            console.log("OTP",otp);
            
            
         }else{
            res.json("email-error")
         }
        }else{
            res.redirect('/change-Email?message=OTP not matching');

        }
    } catch (error) {

        res.redirect("/pageNotFound")

    }
  }

  const verifyEmailOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        if (enteredOtp === req.session.userotp) {
            req.session.userData = req.body.userData;
            res.render('new-Email', {
                userData: req.session.userData,
            });
        } else {
            res.render('change-Email', {
                message: 'OTP not matching',
                userData: req.session.userData
            });
        }
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};



  const changingEmail=async(req,res)=>{
    try {
        const newEmail=req.body.newEmail
        const userId=req.session.user;
        await User.findByIdAndUpdate(userId,{email:newEmail})
        res.redirect('/userProfile')
        
    } catch (error) {
       res.redirect('/pageNotFound') 
    }
  }
  
const getChangePasswordPage = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        
        res.render('changeUserPass')
    } catch (error) {
        console.error("Error rendering change password page:", error);
        res.redirect('/userProfile');
    }
};
  
const changePassword = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        
        const { currentPassword, newPassword, confirmNewPassword } = req.body;
        
        if (!currentPassword || !newPassword || !confirmNewPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ error: 'New passwords do not match' });
        }
        
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({ 
                error: 'Password must have at least 8 characters, including uppercase, lowercase, number and special character' 
            });
        }
        
        const user = await User.findById(req.session.user);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }
        
        const passwordHash = await securePassword(newPassword);
        
        await User.updateOne(
            { _id: user._id },
            { $set: { password: passwordHash } }
        );
        
        req.session.passwordChangedAt = Date.now();
        
        return res.status(200).json({ message: 'Password changed successfully' });
        
    } catch (error) {
        console.error("Error changing password:", error);
        return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const editProfile=async(req,res)=>{
    try {
        const user=req.session.user;

        if(!user){
            return res.redirect('/login')
        }
        const userData=await User.findById(user._id)
        if(!userData){
           return res.redirect('/userProfile')
        }
        res.render('profileEdit',{user:userData,user: req.user})

        
    } catch (error) {
        console.error("Error loading Edit Profile page :",error)
        res.redirect('/userProfile')
        
    }
}

const updateProfile=async(req,res)=>{
    try {

        const userId=req.session.user._id
        const user=await User.findById(userId)
        if(!user){
            return res.redirect('/login')
        }
        const {name,phone}=req.body
        user.name=name;
        user.phone=phone||user.phone

        if(req.file){
            user.profile_image=req.file.path||req.file.secure_url
        }

        user.updatedAt=new Date()
        await user.save()
        req.session.user=user.toObject()
        return res.redirect('/userProfile')
        
    } catch (error) {
        console.error('Error updating Profile')
        res.redirect('/profile/edit')
        
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
    userProfile,
    getAddAddress,
    createAddress,
    getEditAddress,
    updateAddress,
    blockAddress,
    changeEmail,
    changeEmailValid,
    verifyEmailOtp,
    changingEmail,
    getChangePasswordPage,
    changePassword,
    editProfile,
    updateProfile,
    unblockAddress,
}