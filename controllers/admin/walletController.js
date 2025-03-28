const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema')
const express = require('express');
const mongoose = require("mongoose");
const Product = require('../../models/productSchema') 
const Walllet = require('../../models/walletSchema')
const app = express();
const session = require('express-session');
const Wallet = require('../../models/walletSchema');
require('dotenv').config();
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { Transaction } = require('mongodb');

const getWalletManagement = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const transactionType = req.query.type; 
        const searchTerm = req.query.search;
        const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
        const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

        
        const admin = await User.findOne({ isAdmin: true });
        if (!admin) {
            throw new Error('Admin user not found');
        }

     
        let filter = { userId: admin._id };
        let transactionFilter = {};

        if (transactionType) {
            transactionFilter['transactions.transactionType'] = transactionType;
        }

        if (startDate && endDate) {
            transactionFilter['transactions.transactionDate'] = {
                $gte: startDate,
                $lte: endDate
            };
        } else if (startDate) {
            transactionFilter['transactions.transactionDate'] = { $gte: startDate };
        } else if (endDate) {
            transactionFilter['transactions.transactionDate'] = { $lte: endDate };
        }

        if (searchTerm) {
            const searchRegex = new RegExp(searchTerm, 'i');
            transactionFilter['$or'] = [
                { 'transactions.transactionId': searchRegex },
                { 'transactions.transactionDescription': searchRegex }
            ];
        }

      
        const wallets = await Wallet.find(filter)
            .populate({
                path: 'userId',
                select: 'username email createdAt'
            })
            .lean();

       
        const processedWallets = [];
        const allTransactions = [];

        wallets.forEach(wallet => {
            const filteredTransactions = wallet.transactions.filter(transaction => {

                if (transaction.transactionStatus === 'pending') {
                    return false;
                }
                
                if (transactionType && transaction.transactionType !== transactionType) {
                    return false;
                }

                if (startDate && new Date(transaction.transactionDate) < startDate) {
                    return false;
                }

                if (endDate && new Date(transaction.transactionDate) > endDate) {
                    return false;
                }

                if (searchTerm) {
                    const searchRegex = new RegExp(searchTerm, 'i');
                    return (
                        searchRegex.test(transaction.transactionId) ||
                        searchRegex.test(transaction.transactionDescription || '')
                    );
                }

                return true;
            });

            if (filteredTransactions.length > 0) {
                const walletWithFilteredTransactions = {
                    ...wallet,
                    transactions: filteredTransactions
                };
                processedWallets.push(walletWithFilteredTransactions);

                filteredTransactions.forEach(transaction => {
                    allTransactions.push({
                        ...transaction,
                        wallet
                    });
                });
            }
        });

        allTransactions.sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate));

        const paginatedTransactions = allTransactions.slice(skip, skip + limit);

        const paginatedWallets = [];
        const processedTransactionIds = new Set();

        paginatedTransactions.forEach(transaction => {
            let walletEntry = paginatedWallets.find(w => w._id.toString() === transaction.wallet._id.toString());

            if (!walletEntry) {
                walletEntry = {
                    ...transaction.wallet,
                    transactions: []
                };
                paginatedWallets.push(walletEntry);
            }

            if (!processedTransactionIds.has(transaction.transactionId)) {
                walletEntry.transactions.push(transaction);
                processedTransactionIds.add(transaction.transactionId);
            }
        });

        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        const currentMonthTransactions = allTransactions.filter(
            transaction => new Date(transaction.transactionDate) >= currentMonthStart
        );

        const previousMonthTransactions = allTransactions.filter(
            transaction => new Date(transaction.transactionDate) >= previousMonthStart &&
                          new Date(transaction.transactionDate) < currentMonthStart
        );

        const currentMonthCredits = currentMonthTransactions
            .filter(t => t.transactionType === 'credit')
            .reduce((sum, t) => sum + t.transactionAmount, 0);

        const currentMonthDebits = currentMonthTransactions
            .filter(t => t.transactionType === 'debit')
            .reduce((sum, t) => sum + t.transactionAmount, 0);

        const previousMonthCredits = previousMonthTransactions
            .filter(t => t.transactionType === 'credit')
            .reduce((sum, t) => sum + t.transactionAmount, 0);

        const previousMonthDebits = previousMonthTransactions
            .filter(t => t.transactionType === 'debit')
            .reduce((sum, t) => sum + t.transactionAmount, 0);

        const currentMonthUsers = 1; 
        const previousMonthUsers = 1;

        const calculatePercentChange = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return ((current - previous) / previous) * 100;
        };

        const stats = {
            transactionCount: allTransactions.length,
            creditTotal: allTransactions
                .filter(t => t.transactionType === 'credit')
                .reduce((sum, t) => sum + t.transactionAmount, 0),
            debitTotal: allTransactions
                .filter(t => t.transactionType === 'debit')
                .reduce((sum, t) => sum + t.transactionAmount, 0),
            uniqueUsers: 1, 
            transactionChangePercent: calculatePercentChange(
                currentMonthTransactions.length,
                previousMonthTransactions.length
            ),
            creditChangePercent: calculatePercentChange(
                currentMonthCredits,
                previousMonthCredits
            ),
            debitChangePercent: calculatePercentChange(
                currentMonthDebits,
                previousMonthDebits
            ),
            userChangePercent: 0
        };

        const totalPages = Math.ceil(allTransactions.length / limit);

        res.render('walletManagement', {
            title: 'Admin Wallet Management',
            wallets: paginatedWallets,
            stats,
            currentPage: page,
            totalPages,
            totalTransactions: allTransactions.length
        });

    } catch (error) {
        console.error('Error fetching admin wallet transactions:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to fetch admin wallet transactions',
            error
        });
    }
};



module.exports = { getWalletManagement };