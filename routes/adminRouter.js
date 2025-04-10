const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const { adminAuth, userAuth } = require("../middlewares/auth");
const {redirectIfadminLoggedIn}=require('../middlewares/auth')
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const { upload } = require("../helpers/multer"); 
const brandController = require("../controllers/admin/brandController");
const productController = require("../controllers/admin/productController");
const orderController=require('../controllers/admin/orderController')
const couponController=require('../controllers/admin/couponController')
const salesReportController=require('../controllers/admin/salesReportController')
const walletController=require('../controllers/admin/walletController')


router.get("/pageerror", adminController.pageerror);
router.get("/login", adminController.loadLogin);
router.post("/login", redirectIfadminLoggedIn,adminController.login);
router.get("/dashboard", adminAuth, adminController.loadDashboard);
router.get("/logout", adminController.logout);
router.get('/api/orders-data', adminController.getOrdersDataAPI);
router.get('/api/ledger-data', adminController.getLedgerDataAPI);

router.get("/users", adminAuth, customerController.customerInfo);
router.get("/blockCustomer", adminAuth, customerController.customerBlocked);
router.get("/unblockCustomer", adminAuth, customerController.customerunBlocked);

router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addcategory", adminAuth, categoryController.addCategory);
router.get("/listCategory", adminAuth, categoryController.getListCategory);
router.get("/unlistCategory", adminAuth, categoryController.getUnlistCategory);
router.get("/editcategory", adminAuth, categoryController.geteditCategory);
router.post("/editCategory/:id", adminAuth, categoryController.editCategory);
router.put('/addCategoryOffer',adminAuth,categoryController.addOfferCat)
router.put('/removeCategoryOffer',adminAuth,categoryController.removeOfferCat)

router.get("/brands", adminAuth, brandController.getBrandPage);
router.post("/addbrand", adminAuth, upload.single("image"), brandController.addBrand); 
router.get('/blockBrand', adminAuth, brandController.blockBrand);
router.get('/unblockBrand', adminAuth, brandController.unblockBrand);
router.put('/deleteBrand',adminAuth,brandController.deleteBrand)
router.get("/editBrand/:id", adminAuth, brandController.editBrand)
router.post("/updateBrand/:id", adminAuth, upload.single('image'), brandController.updateBrand)

router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post("/addProducts", adminAuth, upload.array("images", 4), productController.addProduct); 
router.get("/products", adminAuth, productController.getAllproduct);
router.put("/blockProduct/:id", adminAuth, productController.blockProduct);
router.get("/editProduct/:id", adminAuth, productController.getEditProduct);
router.put("/editProduct/:id", adminAuth, upload.array("images", 4), productController.submittProduct);
router.put('/addProductOffer/:id',productController.addOffer)
router.put('/removeProductOffer/:id',productController.removeProductOffer)


router.get('/AdminOrder',adminAuth,orderController.getAllOrders)
router.post('/orders/update-item-status', adminAuth,orderController.updateItemStatus);
router.get('/orders/view/:id',adminAuth,orderController.viewOrderDetails)
router.put('/orders/approve-return',adminAuth,orderController.approveReturn)
router.put('/orders/reject-return',adminAuth,orderController.rejectReturn)

router.get('/coupon',adminAuth,couponController.getCoupon)
router.post('/createCoupon',adminAuth,couponController.createCoupon)
router.put('/blockcoupon/:couponId',adminAuth,couponController.blockCoupon)
router.put('/unblockcoupon/:couponId',adminAuth,couponController.unblockCoupon)
router.get('/editcoupon/:id',adminAuth,couponController.getEditCoupon)
router.put('/updatecoupon',adminAuth,couponController.updateCoupon)

router.get('/sales-report',adminAuth, salesReportController.getSalesReport);
router.get('/sales-report/pdf', adminAuth,salesReportController.exportSalesPdf);
router.get('/sales-report/excel', adminAuth,salesReportController.exportSalesExcel);

router.get('/Wallet',adminAuth,walletController.getWalletManagement)


module.exports = router;
