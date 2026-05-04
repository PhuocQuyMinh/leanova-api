const express = require('express');
const dashboardController = require('./dashboard.controller');
const authMiddleware = require('../../core/middlewares/auth.middleware');

const router = express.length ? express.Router() : express.Router();

// Bắt buộc phải đăng nhập và có Role là Admin mới được xem thống kê doanh thu
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('Admin'));

router.get('/admin', dashboardController.getAdminDashboard);

module.exports = router;