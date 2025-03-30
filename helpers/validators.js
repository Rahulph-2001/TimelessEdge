const { body } = require("express-validator");

const validateAddress = [
    body("addressType").isIn(["Home", "Work", "Other"]).withMessage("Invalid address type"),
    body("name").trim().notEmpty().withMessage("Full Name is required"),
    body("city").trim().notEmpty().withMessage("City is required"),
    body("landMark").optional().trim(), 
    body("state").trim().notEmpty().withMessage("State is required"),
    body("pincode")
        .trim()
        .isNumeric().withMessage("ZIP/Postal Code must be a number")
        .isLength({ min: 4, max: 8 }).withMessage("ZIP/Postal Code must be 4 to 8 digits"),
    body("phone")
        .trim()
        .isNumeric().withMessage("Phone number must contain only numbers")
        .isLength({ min: 10, max: 12 }).withMessage("Phone number must be between 10 and 12 digits"),
    body("altPhone")
        .optional() 
        .trim()
        .isNumeric().withMessage("Alternate phone number must contain only numbers")
        .isLength({ min: 10, max: 12 }).withMessage("Alternate phone number must be between 10 and 12 digits"),
];

module.exports = { validateAddress };
