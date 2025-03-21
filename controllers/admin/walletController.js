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


       const wallets=await Wallet.find()
       .populate('userId','username email createdAt')
       .populate('transactions.orderId')
       .sort({'updatedAt':-1})

       let transactionCount=0
       let debitTotal=0
       let creditTotal=0
       let uniqueUsers=new Set()

       wallets.forEach((wallet=>{
        uniqueUsers.add(wallet.userId?wallet.userId.toString():null)
        wallet.transactions.forEach(txn=>{

            transactionCount++
            if(txn.transactionType==="credit"){
                creditTotal+=txn.transactionAmount
            }
            if(txn.transactionType=='debit'){
                debitTotal+=txn.transactionAmount
            }
        })
       }))
       res.render('walletManagement',{
        wallets,
        stats:{
            transactionCount,
            debitTotal,
            creditTotal,
            uniqueUsers:uniqueUsers.size
        }
       })

        
    } catch (error) {
        console.error('Error fetching wallet Data:',error)
        res.status(500).send('Internal Server Error')
        
    }
}


module.exports={walletPage}