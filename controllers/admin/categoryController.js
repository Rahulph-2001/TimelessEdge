
const Category=require("../../models/categorySchema")
const Product = require("../../models/productSchema")



const categoryInfo=async(req,res)=>{
    try {
        const page=parseInt(req.query.page)||1;
        const limit=4
        const skip=(page-1)*limit
        const categoryData=await Category.find({})
        .sort({createdAt:-1})
        .limit(limit)

        const totalCategories=await Category.countDocuments()
        const totalPages=Math.ceil(totalCategories/limit)
        res.render("category",{
            cat:categoryData,
            currentPage:page,
            totalPages:totalPages,
            totalCategories:totalCategories
        });
    } catch (error) {
       console.error(error)
       res.redirect("/pageerror")
    }
}

const addCategory=async(req,res)=>{
    const {name,description}=req.body
    try {
        const existingcategory=await Category.findOne({name})
        if(existingcategory){
            return res.status(400).json({error:"category already exists"})
        }
        const newCategory=new Category({
            name,
            description
        })
        await newCategory.save()
        return res.json({message:"category added successfully"})
    } catch (error) {
        return res.status(500).json({error:"Internal Server error"})
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

const editCategory=async(req,res)=>{
  try {
    const id=req.params.id;
    const {categoryName,description}=req.body;
    const existingCategory=await Category.findOne({name:categoryName})
    if(existingCategory.name){
      return res.status(400).json({error:"Category exists,please choose another name"})
    }

    const updateCategory =await Category.findByIdAndUpdate(id,{
      name:categoryName,
      description:description
    },{new:true})

    if(updateCategory){
      res.redirect("/admin/category");
    }else{
      res.status(404).json({error:"Category not found"})
    }

  } catch (error) {
    res.status(500).json({error:"Internal server error"})
  }
}





module.exports={
    addCategory,categoryInfo,
    getListCategory,getUnlistCategory,geteditCategory,editCategory,
   
}