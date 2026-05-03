const express = require('express');
const userController = require('./user.controller');
const authMiddleware = require('../../core/middlewares/auth.middleware');

const router = express.Router();

// Tất cả các route nằm DƯỚI dòng này đều bị bảo vệ bởi lớp 'protect' (Bắt buộc đăng nhập)
router.use(authMiddleware.protect);

// API xem hồ sơ cá nhân (Chỉ cần đăng nhập là xem được)
router.get('/me', userController.getMe);

// API xem thống kê (Đã đăng nhập, NHƯNG phải mang Role là Admin mới vào được)
router.get('/admin/stats', authMiddleware.restrictTo('Admin'), userController.getAdminDashboard);

module.exports = router;