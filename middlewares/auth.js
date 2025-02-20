const User=require("../models/userSchema")
const userAuth=async(req,res,next)=>{
    try {
      const { user } = req.session;
      if(!user){
        return res.redirect('/login')

      }
      const activeUser = await User.findById(user._id,{isBlocked:true});
      console.log('userAuth mid',activeUser);
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
        console.log('invoked');
        
        return res.redirect('/admin/login');
      }
      const activeAdmin = await User.findOne({ isAdmin: true });
      if (!activeAdmin) {
        return next();
      }
      req.admin = activeAdmin;
  
      // Using req.originalUrl to check the complete URL
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
      
      // If no user exists in session, redirect to login
      if (!user) {
        return next();
      }
  
      // Validate the user's existence in the database
      const activeUser = await User.findById(user._id);
      if (!activeUser) {
        return next();
      }
  
      // Attach activeUser to the request for downstream middleware/routes
      req.user = activeUser;
  
      // Prevent logged in users from accessing the login page or admin routes (if intended)
      // Optionally, redirect to a dashboard/home page instead of the login page.
      console.log('reqpath', req.path)
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
      console.log('invoked 1');
      
      const { admin } = req.session;
      console.log(req.session)
      
      // If there's no admin session, proceed to the route (e.g., login page)
      if (!admin) {
        console.log('invoked 2');
        return next()
      }
      
      console.log(admin)
      // Validate the admin's existence in the database.
      const activeAdmin = await User.findById(admin);
      if (!activeAdmin) {
        console.log('invoked 3');
        return next()
      }
  
      // Attach activeAdmin to the request for downstream middleware/routes.
      req.admin = activeAdmin;
  
      // If an authenticated admin tries to access the admin login page, redirect them to the admin home.
      console.log('path',req.path);
      
      if (req.path === '/login'||req.path==='/') {
        console.log("here");
        return res.redirect('/admin/dashboard');
      }
  
      // Otherwise, let the request continue.
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