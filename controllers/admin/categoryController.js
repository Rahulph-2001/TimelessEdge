
const Category=require("../../models/categorySchema")
const Product = require("../../models/productSchema")
const httpStatus=require('../../utils/httpStatus')



const categoryInfo = async(req,res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4
    const skip = (page-1) * limit
    
    const categoryData = await Category.find({})
      .skip(skip)  
      .sort({createdAt: -1})
      .limit(limit)
    
    const totalCategories = await Category.countDocuments()
    const totalPages = Math.ceil(totalCategories/limit)
    
    res.render("category", {
      cat: categoryData,
      currentPage: page,
      totalPages,
      totalCategories
    });
  } catch (error) {
    console.error('Category info error:', error);
    res.status(500).render('error', {
      message: 'Error loading categories',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
}

const addCategory=async(req,res)=>{
    const {name,description}=req.body
    try {
        const existingcategory=await Category.findOne({name})
        if(existingcategory){
            return res.status(httpStatus.BAD_REQUEST).json({error:"category already exists"})
        }
        const newCategory=new Category({
            name,
            description
        })
        await newCategory.save()
        return res.json({message:"category added successfully"})
    } catch (error) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({error:"Internal Server error"})
    }
}


const getListCategory=async (req,res)=>{
  try {
    let id=req.query.id
    await Category.updateOne({_id:id},{$set:{isListed:false}})
    res.redirect("/admin/category")
  } catch (error) {
    res.redirect("/pageerror")
  }
}
const getUnlistCategory=async(req,res)=>{
  try {
    let id=req.query.id
    await Category.updateOne({_id:id},{$set:{isListed:true}})
    res.redirect("/admin/category")
  } catch (error) {
    res.redirect("/pageerror")
  }
}
const geteditCategory=async(req,res)=>{
  try {
    const id=req.query.id;
    const category=await Category.findOne({_id:id})
    res.render("edit-category",{category:category})
  } catch (error) {
    res.redirect("/pageerror")
  }
}

const editCategory = async(req,res) => {
  try {
    const id = req.params.id;
    const {categoryName, description} = req.body;
    const existingCategory = await Category.findOne({name: categoryName})
    
    // This could throw an error if existingCategory is null
    if(existingCategory && existingCategory._id.toString() !== id) {
      return res.status(httpStatus.BAD_REQUEST).json({
        error: "Category exists, please choose another name"
      })
    }

    const updateCategory = await Category.findByIdAndUpdate(id, {
      name: categoryName,
      description: description
    }, {new: true})

    if(updateCategory) {
      res.redirect("/admin/category");
    } else {
      res.status(httpStatus.NOT_FOUND).json({error: "Category not found"})
    }
  } catch (error) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({error: "Internal server error"})
  }
}


const addOfferCat=async(req,res)=>{
  try {
    const{categoryId,offerPercentage}=req.body

    const updateCategory=await Category.findByIdAndUpdate(categoryId,{categoryOffer:offerPercentage},{new:true})
    if(!updateCategory){
      return res.status(404).json({error:'Category not Found'})
    }

    res.status(200).json({success:true,message:"Offer added successfully"})
  } catch (error) {
    res.status(500).json({error:error.message})
    
  }
}

const removeOfferCat=async(req,res)=>{
  try {
    const { categoryId } = req.body;
    
    // Find the category and set offer to 0
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { categoryOffer: 0 },
      { new: true }
    );
    
    if (!updatedCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.status(200).json({ success: true, message: 'Offer removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


module.exports={
    addCategory,categoryInfo,
    getListCategory,getUnlistCategory,geteditCategory,editCategory,
    addOfferCat,removeOfferCat
   
}