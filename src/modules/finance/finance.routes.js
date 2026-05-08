const express = require('express');
const financeController = require('./finance.controller');
const authMiddleware = require('../../core/middlewares/auth.middleware');

const router = express.Router();

// TẤT CẢ các API tài chính đều phải đăng nhập và phải là Giảng viên
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('Instructor'));

// Thống kê tổng quan
router.get('/stats', financeController.getDashboardStats);

// Biểu đồ
router.get('/chart', financeController.getRevenueChart);

// Rút tiền
router.post('/withdrawals', financeController.createWithdrawalRequest);
router.get('/withdrawals', financeController.getWithdrawalHistory);

module.exports = router;