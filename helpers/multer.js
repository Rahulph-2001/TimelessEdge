const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary"); 
const cloudinary = require("../config/cloudinary"); 


const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "watch-images", 
    format: async (req, file) => "jpg",
    transformation: [{ width: 500, height: 500, crop: "fill" }], 
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG and PNG are allowed."), false);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

module.exports = { upload };
