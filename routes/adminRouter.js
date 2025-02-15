const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const { adminAuth, userAuth } = require("../middlewares/auth");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const { upload } = require("../helpers/multer"); // Remove processImages
const brandController = require("../controllers/admin/brandController");
const productController = require("../controllers/admin/productController");

// Admin routes
router.get("/pageerror", adminController.pageerror);
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/", adminAuth, adminController.loadDashboard);
router.get("/logout", adminController.logout);

// Customer management
router.get("/users", adminAuth, customerController.customerInfo);
router.get("/blockCustomer", adminAuth, customerController.customerBlocked);
router.get("/unblockCustomer", adminAuth, customerController.customerunBlocked);

// Category management
router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addcategory", adminAuth, categoryController.addCategory);
router.get("/listCategory", adminAuth, categoryController.getListCategory);
router.get("/unlistCategory", adminAuth, categoryController.getUnlistCategory);
router.get("/editcategory", adminAuth, categoryController.geteditCategory);
router.post("/editCategory/:id", adminAuth, categoryController.editCategory);

// Brand management
router.get("/brands", adminAuth, brandController.getBrandPage);
router.post("/addbrand", adminAuth, upload.single("image"), brandController.addBrand); // Removed processImages
router.get('/blockBrand', adminAuth, brandController.blockBrand);
router.get('/unblockBrand', adminAuth, brandController.unblockBrand);
router.put('/deleteBrand',adminAuth,brandController.deleteBrand)
router.get("/editBrand/:id", adminAuth, brandController.editBrand)
router.post("/updateBrand/:id", adminAuth, upload.single('image'), brandController.updateBrand)
// Product management
router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post("/addProducts", adminAuth, upload.array("images", 4), productController.addProduct); // Removed processImages
router.get("/products", adminAuth, productController.getAllproduct);
router.put("/blockProduct/:id", adminAuth, productController.blockProduct);
router.get("/editProduct/:id", adminAuth, productController.getEditProduct);
router.put("/editProduct/:id", adminAuth, upload.array("images", 4), productController.submittProduct);


module.exports = router;
