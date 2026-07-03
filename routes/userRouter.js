
const express = require('express')
const router = express.Router()
const userController = require('../controllers/user/userController')
const passport = require('passport')
const { userAuth } = require("../middlewares/auth");
const { redirectIfUserLoggedIn, redirectIfadminLoggedIn } = require('../middlewares/auth')
const profileController = require('../controllers/user/profileController')
const productController = require('../controllers/user/productController')
const cartController = require('../controllers/user/cartController')
const userOrderController = require('../controllers/user/userOrderController');
const { validateAddress } = require('../helpers/validators')
const { upload } = require('../helpers/multer');

// NOTE: Global router.use(redirectIfUserLoggedIn) and router.use(redirectIfadminLoggedIn)
// have been REMOVED. They were applied to ALL routes including public ones (/shop, /filter etc.)
// causing broken redirects for logged-in users. They are now applied per-route below.

router.get("/pageNotFound", userController.pageNotFound)
router.get('/', userController.loadHomepage)

// ── Auth routes ── apply redirect guards only here ────────────────────────────
router.get("/signup", redirectIfUserLoggedIn, userController.loadSignup)
router.post('/signup', redirectIfUserLoggedIn, userController.signup)
router.post("/verify-otp", userController.verifyOtp)
router.post("/resend-otp", userController.resendOtp)

router.get("/auth/google", passport.authenticate("google", { scope: ['profile', 'email'] }))
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/signup' }),
    (req, res) => {
        if (!req.user) {
            return res.redirect("/login")
        }
        req.session.user = req.user
        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        res.redirect(returnTo)
    }
);

router.get("/login", redirectIfUserLoggedIn, redirectIfadminLoggedIn, userController.loadLogin)
router.post("/login", redirectIfUserLoggedIn, userController.login)

// ── Public routes ─────────────────────────────────────────────────────────────
router.get("/", userController.loadHomepage)
router.get("/shop", userController.loadShopping)
router.post("/logout", userController.logout)
router.get('/filter', userController.filterProduct)
router.get('/search', profileController.searchProducts)

// ── User profile ──────────────────────────────────────────────────────────────
router.get('/userProfile', userAuth, profileController.userProfile)

// ── Forgot password (public) ──────────────────────────────────────────────────
router.get("/forgot-password", profileController.getForgotPassPage)
router.post('/verify-email', profileController.verifyForgotOtp)
router.post('/verify-passForgot-otp', profileController.verifyForgotPassOtp)
router.get('/reset-password', profileController.getResetPasspage)
router.post('/resend-forgot-otp', profileController.resendOtp)
router.post('/reset-password', profileController.postNewPassword)

// ── Address routes — all protected; validateAddress applied on mutating routes ─
router.get("/profile/address/add", userAuth, profileController.getAddAddress)
router.post("/profile/address/add", userAuth, validateAddress, profileController.createAddress)
router.get('/profile/address/edit/:id', userAuth, profileController.getEditAddress)
router.put('/profile/address/edit/:id', userAuth, validateAddress, profileController.updateAddress)
router.put('/address/block/:docId/:addressId', userAuth, profileController.blockAddress)
router.put('/address/unblock/:docId/:addressId', userAuth, profileController.unblockAddress)

// ── Email change — protected ──────────────────────────────────────────────────
router.get('/change-Email', userAuth, profileController.changeEmail)
router.post('/change-Email', userAuth, profileController.changeEmailValid)
router.post('/verify-email-otp', userAuth, profileController.verifyEmailOtp)
router.post('/update-email', userAuth, profileController.changingEmail)

// ── Password change — protected ───────────────────────────────────────────────
router.get('/change-password', userAuth, profileController.getChangePasswordPage)
router.post('/change-password', userAuth, profileController.changePassword)

// ── Profile edit — protected ──────────────────────────────────────────────────
router.get('/profile/edit', userAuth, profileController.editProfile)
router.post('/profile/update', userAuth, upload.single('profile_image'), profileController.updateProfile)

// ── Product / Wishlist (public pages, auth on wishlist write) ─────────────────
router.get('/productDetails', productController.productDetails)
router.post('/submit-review', userAuth, productController.submitReview)
router.post('/wishlist/add/:id', userAuth, productController.addWhishlist)
router.get('/wishlist', userAuth, productController.wishListPage)
router.delete('/wishlist/remove/:productId', productController.removeWishlist)
router.post('/cart/add-from-wishlist', userAuth, productController.addToCartFromWishlist)

// ── Cart & Checkout ───────────────────────────────────────────────────────────
router.get('/cart', userAuth, cartController.getCart)
router.post('/cart/add', userAuth, cartController.addToCart)
router.post("/cart/update-cart", userAuth, cartController.updateCart)
router.post("/cart/remove", userAuth, cartController.removeItem)
router.get('/checkout', userAuth, cartController.checkOut)
router.post('/validate-coupon', userAuth, cartController.validateCoupon)
router.post('/order/place', userAuth, cartController.placeOrder)

// ── Payment & Order confirmation ──────────────────────────────────────────────
router.get('/order/confirmation/:orderId', userAuth, userOrderController.confirmOrder)
router.post('/order/create-razorpay-order', userAuth, cartController.createRazorpayOrder)
router.post('/order/verify-payment', userAuth, cartController.verifyPayment)
router.get('/order/payment-failed/:orderId', userAuth, cartController.paymentFailed)
router.post('/order/retry-payment', userAuth, cartController.retryPayment)
router.get('/order/verify-retry-payment', userAuth, cartController.verifyRetryPayment)

// ── Wallet — protected ────────────────────────────────────────────────────────
router.get('/wallet', userAuth, userOrderController.getWalletPage)
router.post('/user/wallet/add-funds', userAuth, userOrderController.addFunds)

// ── Orders — protected ────────────────────────────────────────────────────────
router.get('/orders/:orderId', userAuth, userOrderController.getOrderDetails)
router.post('/api/orders/:orderId/cancel', userAuth, userOrderController.cancelOrder)
router.post('/api/orders/:orderId/items/:itemId/cancel', userAuth, userOrderController.cancelOrderItem)
router.post('/api/orders/:orderId/items/:itemId/return', userAuth, userOrderController.returnOrderItem)
router.get('/api/orders/:orderId/items/:itemId/invoice', userAuth, userOrderController.downloadInvoice)

module.exports = router
