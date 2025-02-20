const Product=require('../../models/productSchema')
const Category=require('../../models/categorySchema')
const User=require('../../models/userSchema')
const Brand=require("../../models/brandSchema")
const mongoose=require('mongoose')
const cloudinary = require("../../config/cloudinary");

const fs=require('fs')
const path=require('path')


const getProductAddPage=async(req,res)=>{
    try{
      const category=await Category.find({isListed:true})
      const brand=await Brand.find({isBlocked:false})
      const product=await Product.find({isBlocked:false})

      res.render("product-add",{
        cat:category,
        brand:brand,
        
    })


    }catch(error){
        res.redirect("/pageerror")
    }
}
const addProduct = async (req, res) => {
    try {
        const { productName, brand, description, regularPrice, salePrice, quantity, color, category } = req.body;
        
        if (!productName || !brand || !description || !regularPrice || !quantity || !category) {
            return res.status(400).json({
                success: false,
                message: "All required fields must be provided"
            });
        }

        const existingProduct = await Product.findOne({ 
            productName: { $regex: new RegExp(`^${productName}$`, 'i') }
        });
        
        if (existingProduct) {
            return res.status(400).json({
                success: false,
                message: "A product with this name already exists"
            });
        }

  
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one product image is required"
            });
        }

        const uploadPromises = req.files.map(file => 
            cloudinary.uploader.upload(file.path, { 
                folder: "products",
                resource_type: "auto"
            })
        );

        const uploadResults = await Promise.all(uploadPromises);
        const images = uploadResults.map(result => result.secure_url);


        const newProduct = new Product({
            productName,
            brand,
            description,
            regularPrice,
            salePrice,
            quantity,
            color,
            category,
            productImages: images
        });

        await newProduct.save();

   
        req.files.forEach(file => {
            fs.unlink(file.path, (err) => {
                if (err) console.error('Error deleting temporary file:', err);
            });
        });

        return res.status(201).json({
            success: true,
            message: "Product added successfully",
            product: newProduct
        });

    } catch (error) {
        console.error("Error adding product:", error);
        
      
        if (req.files) {
            req.files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Error deleting temporary file:', err);
                });
            });
        }

        return res.status(500).json({
            success: false,
            message: "Error adding product",
            error: error.message
        });
    }
};


const getAllproduct = async (req, res) => {
    try {
        const totalCount = await Product.countDocuments({});        
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        const searchQuery = (req.query.search || '').trim();


        const filter = searchQuery 
            ? { productName: { $regex: searchQuery, $options: 'i' } }
            : {};
        // Let's see all product names first
        const allProductNames = await Product.find({}).select('productName');
        const totalProducts = await Product.countDocuments(filter);

        const allProducts = await Product.find(filter)
            .populate("category")
            .populate("brand")
            .limit(limit)
            .skip(skip)
            .exec();

        res.render("product-list", {
            products: allProducts,
            currentPage: page,
            totalPages: Math.ceil(totalProducts/limit),
            searchQuery: searchQuery,
            hasNextPage: page < Math.ceil(totalProducts/limit),
            hasPrevPage: page > 1
        });
    } catch (error) {
        console.log('Error in getAllproduct:', error);
        res.status(500).send("Error retrieving products");
    }
};

const blockProduct=async(req,res)=>{
    try {
        

        const {id} = req.params;
        const{isBlocked}=req.body
       
        if(!id){
            return res.status(400).json({success:false,message:"Product id is required"})
        }
        const product=await Product.findById(id)
        if(!product){
            return res.status(400).json({success:false,message:"Product not found"})
        }
        product.isBlocked=isBlocked
        await product.save()
        res.json({success:true,message:"product blocked successfully"})
    } catch (error) {
        console.error("error blocking product",error)
        res.status(500).json({success:false,message:"Internal Server error"})
    }
}


const getEditProduct=async(req,res)=>{
    try{
        const productId=req.params.id
        const product=await Product.findById(productId).populate("brand").populate("category")
        const brands= await Brand.find()
        const categories=await Category.find()
        if(!product){
            return res.status(400).send("product not found")
        }
        console.log("Brands",brands)
         res.render('product-edit',{product,brands,categories})
    }catch(error){
        console.error(error)
        res.status(500).send("Server error")
    }


}
const validateProductData = (data) => {
    const errors = [];
    
    if (!data.productName?.trim()) {
        errors.push('Product name is required');
    }
    
    if (!mongoose.Types.ObjectId.isValid(data.category)) {
        errors.push('Invalid category selected');
    }
    
    if (!data.descriptionData?.trim()) {
        errors.push('Description is required');
    }
    
    if (isNaN(data.regularPrice) || data.regularPrice <= 0) {
        errors.push('Regular price must be a positive number');
    }
    
    if (data.salePrice && (isNaN(data.salePrice) || data.salePrice <= 0)) {
        errors.push('Sale price must be a positive number');
    }
    
    if (isNaN(data.quantity) || data.quantity < 0) {
        errors.push('Quantity must be a non-negative number');
    }
    
    return errors;
};

// Image handling helper
const handleImageUpdates = async (existingImages, newFiles, uploadsDir) => {
    let updatedImages = [...existingImages];
    
    if (!newFiles || newFiles.length === 0) return updatedImages;
    
    for (const file of newFiles) {
        const imageIndex = parseInt(file.fieldname.replace('images', '')) - 1;
        
        // Remove old image if it exists
        if (updatedImages[imageIndex]) {
            const oldImagePath = path.join(uploadsDir, updatedImages[imageIndex]);
            try {
                await fs.access(oldImagePath);
                await fs.unlink(oldImagePath);
            } catch (error) {
                console.warn(`Warning: Could not delete old image at ${oldImagePath}:`, error.message);
            }
        }
        
        // Update with new image path
        updatedImages[imageIndex] = `uploads/products/${file.filename}`;
    }
    
    return updatedImages;
};

const submittProduct = async (req, res) => {
    try {
        const {
            productName,
            brand,
            category,
            descriptionData,
            regularPrice,
            salePrice,
            quantity,
            color
        } = req.body;

        // Validate input data
        const validationErrors = validateProductData({
            productName,
            category,
            descriptionData,
            regularPrice,
            salePrice,
            quantity
        });

        if (validationErrors.length > 0) {
            return res.status(400).json({ success: false, errors: validationErrors });
        }

        const existingProduct = await Product.findById(req.params.id);
        if (!existingProduct) {
            return res.status(404).json({ success: false, error: "Product not found" });
        }

        let updatedImages = [...existingProduct.productImages];

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const result = await cloudinary.uploader.upload(file.path, { folder: "products" });

                    const oldImageUrl = updatedImages.shift(); 
                    if (oldImageUrl) {
                        const publicId = oldImageUrl.split('/').pop().split('.')[0]; // Extract public ID
                        await cloudinary.uploader.destroy(`products/${publicId}`);
                    }

                    updatedImages.push(result.secure_url);
                } catch (err) {
                    console.error("Cloudinary upload error:", err);
                }
            }
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            {
                productName,
                brand,
                category,
                description: descriptionData,
                regularPrice,
                salePrice,
                quantity,
                color,
                productImages: updatedImages,
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        );

        res.json({ success: true, message: "Product updated successfully", product: updatedProduct });

    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ success: false, error: "Internal Server Error", details: error.message });
    }
};



module.exports={
    getProductAddPage,addProduct,getAllproduct,blockProduct,getEditProduct,submittProduct

}