const mongoose = require('mongoose');


const validators = {
  isValidString: (str) => typeof str === 'string' && str.trim().length > 0,
  isValidNumber: (num) => !isNaN(num) && Number(num) >= 0,
  isValidMongoId: (id) => mongoose.Types.ObjectId.isValid(id),
  isValidUrl: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
};

// Product validation schema
const validateProduct = (data) => {
  const errors = [];
  
  // Required field checks
  if (!validators.isValidString(data.productName)) {
    errors.push('Product name is required and must be a non-empty string');
  }

  if (!validators.isValidString(data.description)) {
    errors.push('Description is required and must be a non-empty string');
  }

  if (!validators.isValidMongoId(data.brand)) {
    errors.push('Valid brand ID is required');
  }

  if (!validators.isValidMongoId(data.category)) {
    errors.push('Valid category ID is required');
  }

  // Number validations
  if (!validators.isValidNumber(data.regularPrice) || data.regularPrice <= 0) {
    errors.push('Regular price must be a positive number');
  }

  if (data.salePrice !== undefined && 
      (!validators.isValidNumber(data.salePrice) || 
       data.salePrice <= 0 || 
       data.salePrice >= data.regularPrice)) {
    errors.push('Sale price must be a positive number less than regular price');
  }

  if (!validators.isValidNumber(data.quantity) || data.quantity < 0) {
    errors.push('Quantity must be a non-negative number');
  }

  // Optional field validations
  if (data.color && !validators.isValidString(data.color)) {
    errors.push('Color must be a valid string');
  }

  // Image validations
  if (data.productImages) {
    if (!Array.isArray(data.productImages)) {
      errors.push('Product images must be an array');
    } else {
      data.productImages.forEach((img, index) => {
        if (!validators.isValidUrl(img)) {
          errors.push(`Invalid URL for image at position ${index + 1}`);
        }
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Search query validation
const validateSearchQuery = (query) => {
  const errors = [];
  const sanitizedQuery = {};

  // Validate and sanitize search parameters
  if (query.productName) {
    if (validators.isValidString(query.productName)) {
      sanitizedQuery.productName = {
        $regex: new RegExp(query.productName.trim(), 'i')
      };
    } else {
      errors.push('Invalid product name format');
    }
  }

  if (query.brand) {
    if (validators.isValidMongoId(query.brand)) {
      sanitizedQuery.brand = query.brand;
    } else {
      errors.push('Invalid brand ID format');
    }
  }

  if (query.category) {
    if (validators.isValidMongoId(query.category)) {
      sanitizedQuery.category = query.category;
    } else {
      errors.push('Invalid category ID format');
    }
  }

  // Price range validation
  if (query.minPrice || query.maxPrice) {
    const priceQuery = {};
    
    if (query.minPrice) {
      if (validators.isValidNumber(query.minPrice)) {
        priceQuery.$gte = Number(query.minPrice);
      } else {
        errors.push('Invalid minimum price');
      }
    }
    
    if (query.maxPrice) {
      if (validators.isValidNumber(query.maxPrice)) {
        priceQuery.$lte = Number(query.maxPrice);
      } else {
        errors.push('Invalid maximum price');
      }
    }
    
    if (Object.keys(priceQuery).length > 0) {
      sanitizedQuery.regularPrice = priceQuery;
    }
  }

  // Quantity validation
  if (query.inStock === 'true') {
    sanitizedQuery.quantity = { $gt: 0 };
  } else if (query.inStock === 'false') {
    sanitizedQuery.quantity = 0;
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedQuery
  };
};

module.exports = {
  validateProduct,
  validateSearchQuery,
  validators
};