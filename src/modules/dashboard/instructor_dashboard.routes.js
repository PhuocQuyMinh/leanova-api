const express = require('express');
const dashboardController = require('./instructor_dashboard.controller');
const authMiddleware = require('../../core/middlewares/auth.middleware');

const router = express.Router();

// ==========================================
// NHÓM API DÀNH CHO GIẢNG VIÊN
// ==========================================
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('Instructor'));

// 1. Lấy dữ liệu tổng quan cho trang chủ Dashboard
router.get('/global-stats', dashboardController.getGlobalStats);
router.get('/periodic-stats', dashboardController.getPeriodicStats);

// 2. Lấy dữ liệu phân tích chi tiết của 1 khóa học
router.get('/courses/:courseId/stats', dashboardController.getCourseSpecificStats);

// 3. Quản lý reviews
router.get('/my-reviews', dashboardController.getInstructorReviews);
router.patch('/reviews/:id/reply', dashboardController.replyToReview);
router.post('/reviews/:id/report', dashboardController.reportReview);


// ==========================================
// NHÓM API DÀNH CHO KIỂM DUYỆT VIÊN (MOD/ADMIN)
// ==========================================
router.use(authMiddleware.restrictTo('Mod', 'Admin'));

// [MỚI BỔ SUNG] Lấy danh sách Review bị báo cáo
router.get('/mod/reported', dashboardController.getReportedReviews);

// Xử lý báo cáo (Xóa hoặc Từ chối) - Hàm này đã có ở Controller từ phần trước
router.patch('/mod/:id/moderate', dashboardController.handleReviewReport);

module.exports = router;