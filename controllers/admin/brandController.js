const Brand = require("../../models/brandSchema");
const Product = require("../../models/productSchema");
const monggose=require('mongoose')

const getBrandPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        const brandData = await Brand.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalBrands = await Brand.countDocuments();
        const totalPages = Math.ceil(totalBrands / limit);
        
        res.render("brands", {
            data: brandData,
            currentPage: page,
            totalPages: totalPages,
            totalBrands: totalBrands
        });

    } catch (error) {
        console.error("Error fetching brand page:", error);
        res.redirect("/pageerror");
    }
};
const addBrand = async (req, res) => {
    try {
        // console.log("Received form data:", req.body);
        // console.log("Received file data:", req.file);

        const brand = req.body.name ? req.body.name.trim() : null;
        if (!brand) {
            return res.redirect("/admin/brands?error=Brand name is required");
        }

        const findBrand = await Brand.findOne({ name: brand });
        if (findBrand) {
            return res.redirect("/admin/brands?error=Brand already exists");
        }

       
        const imageUrl = req.file ? req.file.path : null;

        if (!imageUrl) {
            console.log("Error: No image uploaded");
            return res.redirect("/admin/brands?error=Image upload failed");
        }
        
        const newBrand = new Brand({
            name: brand,
            brandImage: [imageUrl], 
        });

        await newBrand.save();
        res.redirect("/admin/brands");

    } catch (error) {
        console.error("Error adding brand:", error);
        res.redirect("/pageerror");
    }
};


const blockBrand = async (req, res) => {
    try {
        const id = req.query.id;
        console.log("Blocking brand with ID:", id); 
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect("/admin/brands");
    } catch (error) {
        console.error("Error blocking brand:", error);
        res.redirect("/pageerror");
    }
};

const unblockBrand = async (req, res) => {
    try {
        const id = req.query.id;
        console.log("Unblocking brand with ID:", id);
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.redirect("/admin/brands");
    } catch (error) {
        console.error("Error unblocking brand:", error);
        res.redirect("/pageerror");
    }
};


const deleteBrand=async(req,res)=>{
    try {
        const {id}=req.body;
        if(!id){
            return res.status(400).redirect("/pageerror")
        }
        await Brand.deleteOne({_id:id})
        res.redirect("/admin/brands")
    } catch (error) {
        console.error("Error deleting brand:",error)
        res.status(500).redirect("/pageerror")
    }
}


const editBrand = async (req, res) => {
    try {
        const brandId = req.params.id;
        const brand = await Brand.findById(brandId);
        
        if (!brand) {
            return res.redirect("/admin/brands?error=Brand not found");
        }
        
        res.render("editBrand", { 
            brand,
            error: req.query.error,
            success: req.query.success 
        });
    } catch (error) {
        console.error("Error in editBrand:", error);
        res.redirect("/admin/brands");
    }
};

const updateBrand = async (req, res) => {
    try {
        const brandId = req.params.id;
        const { name } = req.body;

        if (!name || name.trim().length === 0) {
            return res.redirect(`/admin/editBrand/${brandId}?error=Brand name is required`);
        }

        const existingBrand = await Brand.findOne({ 
            name: name.trim(), 
            _id: { $ne: brandId } 
        });
        
        if (existingBrand) {
            return res.redirect(`/admin/editBrand/${brandId}?error=Brand name already exists`);
        }

        const updateData = {
            name: name.trim()
        };

        if (req.file) {
            updateData.brandImage = [req.file.path];
        }

        await Brand.findByIdAndUpdate(brandId, updateData);
        res.redirect("/admin/brands?success=Brand updated successfully");

    } catch (error) {
        console.error("Error updating brand:", error);
        res.redirect(`/admin/editBrand/${brandId}?error=Error updating brand`);
    }
};


module.exports = {
    getBrandPage,
    addBrand,
    blockBrand,
    unblockBrand,
    deleteBrand,
    editBrand,
    updateBrand
};



