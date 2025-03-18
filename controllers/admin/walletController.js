const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema')
const express = require('express');
const mongoose = require("mongoose");
const Product=require('../../models/productSchema') 
const Walllet=require('../../models/walletSchema')
const app = express();
const session = require('express-session');
const Wallet = require('../../models/walletSchema');
require('dotenv').config();
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');



const walletPage=async(req,res)=>{
    try {
        const wallets = await Wallet.find()
            .populate('userId', 'username email') 
            .sort({ 'transactions.transactionDate': -1 }); 

        res.render('walletManagement', {
            wallets: wallets
        });
    } catch (error) {
        console.error('Error fetching wallet data:', error);
        res.status(500).send('Server Error');
    }
}


module.exports={walletPage}