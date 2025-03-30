const User=require("../models/userSchema")
const userAuth=async(req,res,next)=>{
    try {
      const { user } = req.session;
      if(!user){
        return res.redirect('/login')

      }
      const activeUser = await User.findById(user._id,{isBlocked:true});
      if (activeUser.isBlocked==true) {
        req.session.destroy()
        res.redirect('/login')
      }
      return next()

      
    } catch (error) {
      console.log(error);
      
    }
}
const adminAuth = async (req, res, next) => {
    try {
      if (!req.session.admin) {
        
        return res.redirect('/admin/login');
      }
      const activeAdmin = await User.findOne({ isAdmin: true });
      if (!activeAdmin) {
        return next();
      }
      req.admin = activeAdmin;
  
      if (req.originalUrl === '/admin/login') {
        return res.redirect('/admin');
      }
      
      return next();
    } catch (error) {
      console.log(error);
      res.status(500).send("Internal Server Error");
    }
  };
  


const redirectIfUserLoggedIn = async (req, res, next) => {
    try {
      const { user } = req.session;
      
      if (!user) {
        return next();
      }
  
      const activeUser = await User.findById(user._id);
      if (!activeUser) {
        return next();
      }
  
      req.user = activeUser;
        if (req.path === '/login' || req.path.includes('admin')) {
        return res.redirect('/');
      }
      return next();
    } catch (err) {
      console.error('Error in authentication middleware:', err);
      res.status(500).send("Internal Server Error");
    }
  };




  const redirectIfadminLoggedIn = async (req, res, next) => {
    try {
      
      const { admin } = req.session;
      
      if (!admin) {
        return next()
      }
      
      console.log(admin)
      const activeAdmin = await User.findById(admin);
      if (!activeAdmin) {
        return next()
      }
  
      req.admin = activeAdmin;

      
      if (req.path === '/login'||req.path==='/') {
        return res.redirect('/admin/dashboard');
      }
  
      next();
    } catch (err) {
      console.error('Error in admin authentication middleware:', err);
      res.status(500).send("Internal Server Error");
    }
  };
  
  
module.exports={
    userAuth,
    adminAuth,
    redirectIfUserLoggedIn,
    redirectIfadminLoggedIn
}