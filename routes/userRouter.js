const express=require('express')
const router=express.Router()
const userController=require('../controllers/user/userController')
const passport = require('passport')
const  userAuth = require("../middlewares/auth");
const profileController=require('../controllers/user/profileController')
const productController=require('../controllers/user/productController')



router.get("/pageNotFound",userController.pageNotFound)
router.get('/',userController.loadHomepage)
router.get("/signup",userController.loadSignup)
router.post('/signup',userController.signup)
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)
router.get("/auth/google",passport.authenticate("google",{scope:['profile','email']}))
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }),
    (req, res) => {
        if(!req.user){
            return res.redirect("/login")
        }
        req.session.user=req.user
        res.redirect("/")
    }
);
router.get("/login",userController.loadLogin)
router.post("/login",userController.login)

router.get("/",userController.loadHomepage)
router.get("/shop",userController.loadShopping)
router.get("/logout",userController.logout)
router.get('/filter',userController.filterProduct)
router.get('/search',profileController.searchProducts)

router.get("/forgot-password",profileController.getForgotPassPage)
router.post('/verify-email',profileController.verifyForgotOtp)
router.post('/verify-passForgot-otp',profileController.verifyForgotPassOtp)
router.get('/reset-password',profileController.getResetPasspage)
router.post('/resend-forgot-otp',profileController.resendOtp)
router.post('/reset-password',profileController.postNewPassword)

router.get('/productDetails',productController.productDetails)

module.exports= router 