const express = require('express');
const testimonialController = require('./testimonial.controller');
const authMiddleware = require('../../core/middlewares/auth.middleware');

const router = express.Router();

// ==========================================
// PUBLIC ROUTES: Ai cũng xem được
// ==========================================
// Public: Lấy danh sách đánh giá đã duyệt để hiển thị lên Landing Page
router.get('/', testimonialController.getPublicList);

// ==========================================
// PROTECTED ROUTES: Lớp bảo vệ 1 (Phải đăng nhập)
// ==========================================
router.use(authMiddleware.protect);

// Học viên gửi đánh giá nền tảng
router.post('/', testimonialController.create);

// ==========================================
// ADMIN ROUTES: Lớp bảo vệ 2 (Giới hạn quyền)
// ==========================================
// Chỉ Admin hoặc Moderator mới được dùng các router bên dưới
router.use(authMiddleware.restrictTo('Admin', 'Mod'));

// Lấy danh sách toàn bộ đánh giá để quản lý
router.get('/admin', testimonialController.getAdminList);

// Cập nhật trạng thái đánh giá (Duyệt: Approved / Từ chối: Rejected)
router.patch('/admin/:id/status', testimonialController.updateStatus);

module.exports = router;