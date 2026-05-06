const express = require('express');
const categoryController = require('./category.controller');
const authMiddleware = require('../../core/middlewares/auth.middleware');

const router = express.Router();

// Public: Ai cũng xem được danh sách danh mục (để hiển thị trên menu trang chủ)
router.get('/', categoryController.getAllCategories);

// Lớp bảo vệ 1: Phải đăng nhập cho các hành động bên dưới
router.use(authMiddleware.protect);

// Lớp bảo vệ 2: Chỉ Admin mới có quyền tạo danh mục hệ thống để tránh rác dữ liệu
router.use(authMiddleware.restrictTo('Admin'));

// Quản lý danh mục
router.post('/', categoryController.createCategory);

module.exports = router;