const express = require('express');
const financeController = require('./finance.controller');
const authMiddleware = require('../../core/middlewares/auth.middleware');

const router = express.Router();

// TẤT CẢ các API tài chính đều phải đăng nhập và phải là Giảng viên
router.use(authMiddleware.protect);
// ==========================================
// NHÓM API DÀNH CHO GIẢNG VIÊN
// ==========================================
// Gán middleware vào một biến để code ngắn gọn và dễ đọc hơn
const isInstructor = authMiddleware.restrictTo('Instructor');

// Thống kê tổng quan và Biểu đồ
router.get('/stats', isInstructor, financeController.getDashboardStats);
router.get('/chart', isInstructor, financeController.getRevenueChart);

// Rút tiền
router.post('/withdrawals', isInstructor, financeController.createWithdrawalRequest);
router.get('/withdrawals', isInstructor, financeController.getWithdrawalHistory);

// Quản lý thông tin tài khoản ngân hàng và cấu hình
router.get('/settings', isInstructor, financeController.getSettings);
router.put('/settings', isInstructor, financeController.updateSettings);

// ==========================================
// NHÓM API DÀNH CHO ADMIN
// ==========================================
// Gán middleware quyền Admin
const isAdmin = authMiddleware.restrictTo('Admin');

// Thay đổi phí toàn hệ thống
router.patch('/admin/global-commission', isAdmin, financeController.updateGlobalCommission);

// Thay đổi phí cho từng giảng viên cụ thể
router.patch('/admin/instructor-commission', isAdmin, financeController.updateInstructorCommission);

// [MỚI] Quản lý lệnh rút tiền
router.get('/admin/withdrawals', isAdmin, financeController.getAllWithdrawalRequests);
router.patch('/admin/withdrawals/:id/status', isAdmin, financeController.reviewWithdrawalRequest);

router.get('/settings/global-commission', financeController.getGlobalCommission);

router.get('/platform-stats', financeController.getPlatformStats);

router.get(
    '/top-instructors',
    authMiddleware.protect,
    authMiddleware.restrictTo('Admin'),
    financeController.getTopInstructors
);

module.exports = router;