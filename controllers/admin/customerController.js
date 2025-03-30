const User = require("../../models/userSchema");
const httpstatus=require('../../utils/httpStatus')

const customerInfo = async (req, res) => {
    try {
        let search = req.query.search || ""; 
        let page = parseInt(req.query.page) || 1; 
        const limit = 3;

        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } }, 
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();
        const count = await User.countDocuments({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        });

   
        res.render("customerInfo", {
            data: userData,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            searchQuery: search,
        });
    } catch (error) {
        console.error("Error fetching customer info:", error);
        res.status(httpstatus.INTERNAL_SERVER_ERROR).send("Internal Server Error");
    }
};

const customerBlocked =async(req,res)=>{
    try{
        let id=req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect("/admin/users")
    }catch(error){
        res.redirect("/pageerror")
    }
}
const customerunBlocked=async(req,res)=>{
    try {
        let id=req.query.id;
        await User.updateOne({_id:id},{isBlocked:false})
        res.redirect('/admin/users')
    } catch (error) {
        res.redirect("/pageerror")
    }
}
    


module.exports = { customerInfo,customerBlocked,customerunBlocked };
