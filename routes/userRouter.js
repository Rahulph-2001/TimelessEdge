
const express=require('express')
const router=express.Router()
const userController=require('../controllers/user/userController')
const passport = require('passport')
const  {userAuth} = require("../middlewares/auth");
const {redirectIfUserLoggedIn,redirectIfadminLoggedIn} = require('../middlewares/auth')
const profileController=require('../controllers/user/profileController')
const productController=require('../controllers/user/productController')
const cartController=require('../controllers/user/cartController')
const userOrderController=require('../controllers/user/userOrderController');
const {validateAddress}=require('../helpers/validators')
const { upload } = require('../helpers/multer');


router.use(redirectIfUserLoggedIn)

router.use(redirectIfadminLoggedIn)


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
router.get('/userProfile',userAuth,profileController.userProfile)

router.get("/forgot-password",profileController.getForgotPassPage)
router.post('/verify-email',profileController.verifyForgotOtp)
router.post('/verify-passForgot-otp',profileController.verifyForgotPassOtp)
router.get('/reset-password',profileController.getResetPasspage)
router.post('/resend-forgot-otp',profileController.resendOtp)
router.post('/reset-password',profileController.postNewPassword)
router.get("/profile/address/add",userAuth,profileController.getAddAddress)
router.post("/profile/address/add",profileController.createAddress)
router.get('/profile/address/edit/:id',profileController.getEditAddress);
router.put('/profile/address/edit/:id',profileController.updateAddress)
router.put('/address/block/:docId/:addressId', profileController.blockAddress);
router.put('/address/unblock/:docId/:addressId', profileController.unblockAddress);
router.get('/change-Email',userAuth,profileController.changeEmail)
router.post('/change-Email',userAuth,profileController.changeEmailValid)
router.post('/verify-email-otp',userAuth,profileController.verifyEmailOtp)
router.post('/update-email',userAuth,profileController.changingEmail)
router.get('/change-password',userAuth,profileController.getChangePasswordPage)
router.post('/change-password',userAuth,profileController.changePassword)
router.get('/profile/edit',profileController.editProfile)
router.post('/profile/update', upload.single('profile_image'),profileController.updateProfile)


router.get('/productDetails',productController.productDetails)
router.post('/submit-review',productController.submitReview)
router.post('/wishlist/add/:id',userAuth,productController.addWhishlist)
router.get('/wishlist',userAuth,productController.wishListPage)
router.delete('/wishlist/remove/:productId',productController.removeWishlist)
router.post('/cart/add-from-wishlist',productController.addToCartFromWishlist)

router.get('/cart',userAuth,cartController.getCart)
router.post('/cart/add',cartController.addToCart)
router.post("/cart/update-cart",cartController.updateCart)
router.post("/cart/remove",cartController.removeItem)
router.get('/checkout',cartController.checkOut)
router.post('/validate-coupon',cartController.validateCoupon)
router.post('/order/place',cartController.placeOrder)

router.get('/order/confirmation/:orderId',userOrderController.confirmOrder)
router.post('/order/create-razorpay-order', cartController.createRazorpayOrder)
router.post('/order/verify-payment', cartController.verifyPayment)
router.get('/order/payment-failed/:orderId',cartController.paymentFailed)
router.post('/order/retry-payment', cartController.retryPayment)
router.get('/order/verify-retry-payment', cartController.verifyRetryPayment)
router.get('/wallet',userOrderController.getWalletPage)



router.post('/user/wallet/add-funds',userOrderController.addFunds);
router.get('/orders/:orderId',userOrderController.getOrderDetails)
router.post('/api/orders/:orderId/cancel', userAuth, userOrderController.cancelOrder);
router.post('/api/orders/:orderId/items/:itemId/cancel', userAuth, userOrderController.cancelOrderItem);
router.post('/api/orders/:orderId/items/:itemId/return', userAuth, userOrderController.returnOrderItem);
router.get('/api/orders/:orderId/items/:itemId/invoice', userAuth, userOrderController.downloadInvoice);
module.exports= router 
