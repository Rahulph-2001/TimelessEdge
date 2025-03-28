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

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

const getDateRange = (dateRange, startDate, endDate) => {
    const today = new Date();
    let start, end;
    
    if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999); 
    } else if (dateRange) {
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        
        switch (dateRange) {
            case 'today':
                start = new Date(today);
                start.setHours(0, 0, 0, 0);
                break;
            case 'week':
                start = new Date(today);
                start.setDate(today.getDate() - today.getDay()); 
                start.setHours(0, 0, 0, 0);
                break;
            case 'month':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                break;
            case 'year':
                start = new Date(today.getFullYear(), 0, 1);
                break;
            default:
                start = new Date(today);
                start.setDate(today.getDate() - 30);
                start.setHours(0, 0, 0, 0);
        }
    } else {
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        start = new Date(today);
        start.setDate(today.getDate() - 30);
        start.setHours(0, 0, 0, 0);
    }
    
    return { start, end };
};

const getCustomerNameFromOrder = async (order) => {
    try {
        if (!order.address) {
            return "Unknown Customer";
        }
        
        const addressDoc = await Address.findOne({
            "address._id": order.address
        }).populate('userId', 'name');
        
        if (addressDoc && addressDoc.userId && addressDoc.userId.name) {
            return addressDoc.userId.name;
        }
        
        return "Unknown Customer";
    } catch (error) {
        console.error(`Error fetching customer name for order ${order.orderId}:`, error);
        return "Unknown Customer";
    }
};

const getSalesReport = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const { start, end } = getDateRange(
      req.query.dateRange,
      req.query.startDate,
      req.query.endDate
    );

    const dateQuery = {
      createdOn: {
        $gte: start,
        $lte: end
      },
      status:{$nin:['Pending', 'Processing', 'Shipped', 'Cancelled', 'Return Request', 'Returned','Paid']}
    };

    const orders = await Order.find(dateQuery)
      .populate({
        path: 'orderedItems.product',
        select: 'productName'
      })
      .sort({ createdOn: -1 })
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments(dateQuery);
    
    const allOrdersInRange = await Order.find(dateQuery)
      .populate({
        path: 'orderedItems.product',
        select: 'productName'
      });

    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        try {
          if (!order.address) {
            return {
              ...order._doc,
              addressDetails: null,
              customerName: "Unknown Customer"
            };
          }
          
          const addressDoc = await Address.findOne({
            "address._id": order.address
          }).populate('userId', 'name');
          
          let addressDetails = null;
          let customerName = "Unknown Customer";
          
          if (addressDoc && addressDoc.address && addressDoc.address.length > 0) {
            addressDetails = addressDoc.address.find(
              addr => addr._id.toString() === order.address.toString()
            );
            
            if (!addressDetails && addressDoc.address.length > 0) {
              addressDetails = addressDoc.address[0];
            }
            
            if (addressDoc.userId && addressDoc.userId.name) {
              customerName = addressDoc.userId.name;
            }
          }
          
          return {
            ...order._doc,
            addressDetails,
            customerName
          };
        } catch(error) {
          console.error(`Error fetching address for order ${order.orderId}:`, error);
          return {
            ...order._doc,
            addressDetails: null,
            customerName: "Unknown Customer"
          };
        }
      })
    );

    const allOrdersWithDetails = await Promise.all(
      allOrdersInRange.map(async (order) => {
        try {
          if (!order.address) return { ...order._doc, userId: null };
          
          const addressDoc = await Address.findOne({
            "address._id": order.address
          }).populate('userId', 'name');
          
          return {
            ...order._doc,
            userId: addressDoc && addressDoc.userId ? addressDoc.userId._id : null
          };
        } catch(error) {
          return { ...order._doc, userId: null };
        }
      })
    );

    const totalSales = allOrdersInRange.reduce(
      (sum, order) => sum + order.finalAmount,
      0
    );

    const uniqueCustomerIds = new Set();
    allOrdersWithDetails.forEach(order => {
      if (order.userId) {
        uniqueCustomerIds.add(order.userId.toString());
      }
    });

    const avgOrderValue = totalSales / (allOrdersInRange.length || 1);

    const formattedOrders = ordersWithDetails.map(order => {
      return {
        orderNumber: order.orderId,
        createdAt: order.createdOn,
        customerName: order.customerName,
        products: order.orderedItems.map(item => ({
          name: item.product ? item.product.productName : 'Unknown Product',
          quantity: item.quantity
        })),
        totalAmount: order.finalAmount,
        status: order.status
      };
    });

    res.render('salesReport', {
      orders: formattedOrders,
      totalSales,
      totalOrders: allOrdersInRange.length,
      totalCustomers: uniqueCustomerIds.size,
      avgOrderValue,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      req
    });

  } catch (error) {
    console.error('Error generating sales report:', error);
    res.redirect('/admin/dashboard');
  }
};

const exportSalesExcel = async (req, res) => {
  try {
      const { start, end } = getDateRange(
          req.query.dateRange, 
          req.query.startDate, 
          req.query.endDate
      );
      
      const dateFilter = {
          createdOn: {
              $gte: start,
              $lte: end
          },
          status: 'Delivered' 
      };

      const orders = await Order.find(dateFilter)
          .populate('orderedItems.product')
          .sort({ createdOn: -1 });

      const salesData = await Order.aggregate([
          { $match: dateFilter },
          { 
              $group: {
                  _id: null,
                  totalSales: { $sum: "$finalAmount" },
                  totalDiscount: { $sum: "$discount" }
              }
          }
      ]);

      const totalSales = salesData.length > 0 ? salesData[0].totalSales : 0;
      const totalDiscount = salesData.length > 0 ? salesData[0].totalDiscount : 0;
      
      const uniqueCustomers = await Order.distinct('address', dateFilter).length;

      const formatDate = (date) => {
          return new Date(date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
          });
      };
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sales Report');
      
      worksheet.addRow(['Sales Report']);
      worksheet.mergeCells('A1:G1');
      worksheet.getCell('A1').font = { size: 16, bold: true };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };
      
      const startDate = formatDate(start);
      const endDate = formatDate(end);
      worksheet.addRow([`Period: ${startDate} to ${endDate}`]);
      worksheet.mergeCells('A2:G2');
      worksheet.getCell('A2').alignment = { horizontal: 'center' };
      
      worksheet.addRow(['']);
      const summaryRow = worksheet.addRow(['Summary']);
      summaryRow.font = { bold: true };
      worksheet.addRow(['Total Sales:', `₹${totalSales.toLocaleString()}`]);
      worksheet.addRow(['Total Orders:', orders.length]);
      worksheet.addRow(['Total Discount:', `₹${totalDiscount.toLocaleString()}`]);
      worksheet.addRow(['Unique Customers:', uniqueCustomers]);
      worksheet.addRow(['']);
      
      const headerRow = worksheet.addRow([
          'Sl No', 'Order ID', 'Customer', 'Products', 'Date', 'Discount Amount', 'Final Amount'
      ]);
      headerRow.font = { bold: true };
      headerRow.eachCell((cell) => {
          cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE9EAEC' }
          };
          cell.border = {
              top: { style: 'thin' },
              bottom: { style: 'thin' },
              left: { style: 'thin' },
              right: { style: 'thin' }
          };
      });
      
      const customersMap = new Map();
      await Promise.all(orders.map(async (order) => {
          customersMap.set(order._id.toString(), await getCustomerNameFromOrder(order));
      }));
      
      orders.forEach((order, index) => {
          const products = order.orderedItems.map(item => 
              `${item.product ? item.product.productName : 'Unknown Product'} (${item.quantity})`
          ).join('\n');
          
          const customerName = customersMap.get(order._id.toString()) || "Unknown Customer";
          
          worksheet.addRow([
              index + 1,
              order.orderId,
              customerName,
              products,
              formatDate(order.createdOn),
              `₹${order.discount.toLocaleString()}`,
              `₹${order.finalAmount.toLocaleString()}`
          ]);
      });
      
      worksheet.columns.forEach(column => {
          let maxLength = 0;
          column.eachCell({ includeEmpty: true }, cell => {
              const columnLength = cell.value ? cell.value.toString().length : 10;
              if (columnLength > maxLength) {
                  maxLength = columnLength;
              }
          });
          column.width = maxLength < 10 ? 10 : maxLength + 2;
      });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.xlsx`);
      
      await workbook.xlsx.write(res);
      res.end();
      
  } catch (error) {
      console.error('Error generating Excel:', error);
      res.status(500).json({ success: false, message: 'Error generating Excel report' });
  }
};

const exportSalesPdf = async (req, res) => {
  try {
      const { start, end } = getDateRange(
          req.query.dateRange, 
          req.query.startDate, 
          req.query.endDate
      );
      
      const dateFilter = {
          createdOn: {
              $gte: start,
              $lte: end
          },
          status: 'Delivered' 
      };

      const orders = await Order.find(dateFilter)
          .populate('orderedItems.product')
          .sort({ createdOn: -1 });

      const salesData = await Order.aggregate([
          { $match: dateFilter },
          { 
              $group: {
                  _id: null,
                  totalSales: { $sum: "$finalAmount" },
                  totalDiscount: { $sum: "$discount" }
              }
          }
      ]);

      const totalSales = salesData.length > 0 ? salesData[0].totalSales : 0;
      const totalDiscount = salesData.length > 0 ? salesData[0].totalDiscount : 0;
      
      const uniqueCustomers = await Order.distinct('address', dateFilter).length;

      const formatDate = (date) => {
          return new Date(date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
          });
      };
      
      const customersMap = new Map();
      await Promise.all(orders.map(async (order) => {
          customersMap.set(order._id.toString(), await getCustomerNameFromOrder(order));
      }));
      
      const doc = new PDFDocument({ margin: 50 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.pdf`);
      
      doc.pipe(res);
      
      doc.fontSize(25).text('Sales Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).text(`Period: ${formatDate(start)} to ${formatDate(end)}`, { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(16).text('Summary', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Total Sales: ₹${totalSales.toLocaleString()}`);
      doc.fontSize(12).text(`Total Orders: ${orders.length}`);
      doc.fontSize(12).text(`Total Discount: ₹${totalDiscount.toLocaleString()}`);
      doc.fontSize(12).text(`Unique Customers: ${uniqueCustomers}`);
      doc.moveDown();
      
      doc.fontSize(16).text('Order Details', { underline: true });
      doc.moveDown(0.5);
      
      const tableTop = doc.y;
      const tableHeaders = ['Order ID', 'Date', 'Customer', 'Products', 'Amount', 'Status'];
      const columnWidth = 80;
      
      doc.fontSize(10);
      doc.font('Helvetica-Bold');
      tableHeaders.forEach((header, i) => {
          doc.text(header, 50 + (i * columnWidth), tableTop, { width: columnWidth, align: 'left' });
      });
      doc.moveDown();
      
      doc.moveTo(50, doc.y).lineTo(50 + (tableHeaders.length * columnWidth), doc.y).stroke();
      doc.moveDown(0.5);
      
      doc.font('Helvetica');
      let pageRows = 0;
      const maxRowsPerPage = 25;
      
      orders.forEach((order, index) => {
          if (pageRows >= maxRowsPerPage) {
              doc.addPage();
              pageRows = 0;
              doc.fontSize(16).text('Order Details (Continued)', { underline: true });
              doc.moveDown(0.5);
              doc.fontSize(10);
              
              doc.font('Helvetica-Bold');
              tableHeaders.forEach((header, i) => {
                  doc.text(header, 50 + (i * columnWidth), doc.y, { width: columnWidth, align: 'left' });
              });
              doc.moveDown();
              doc.moveTo(50, doc.y).lineTo(50 + (tableHeaders.length * columnWidth), doc.y).stroke();
              doc.moveDown(0.5);
              doc.font('Helvetica');
          }

          const customerName = customersMap.get(order._id.toString()) || "Unknown Customer";
          const products = order.orderedItems.map(item => 
              `${item.product ? item.product.productName : 'Unknown'} (${item.quantity})`
          ).join(', ');
          
          const rowData = [
              order.orderId,
              formatDate(order.createdOn),
              customerName,
              products.length > 20 ? products.substring(0, 20) + '...' : products,
              `₹${order.finalAmount.toLocaleString()}`,
              order.status
          ];
          
          const rowTop = doc.y;
          rowData.forEach((text, i) => {
              doc.text(text.toString(), 50 + (i * columnWidth), rowTop, { width: columnWidth, align: 'left' });
          });
          
          doc.moveDown();
          pageRows++;
      });
      
      doc.end();
  } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ success: false, message: 'Error generating PDF report' });
  }
};

module.exports={getSalesReport,exportSalesExcel,exportSalesPdf}