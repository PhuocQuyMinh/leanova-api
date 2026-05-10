const express = require('express');
const moderationController = require('./moderation.controller');
const authMiddleware = require('../../core/middlewares/auth.middleware');
const upload = require('../../core/middlewares/upload.middleware'); // Import multer

const router = express.Router();
// Get system term
router.get('/settings/instructor-terms', moderationController.getTerms);

router.use(authMiddleware.protect); // Yêu cầu đăng nhập

// 1. Nút thắt dành cho Học viên (Student) nộp đơn
// Chỉ Student mới nộp được đơn, Giảng viên rồi thì không nộp nữa
router.post(
    '/apply-instructor',
    authMiddleware.restrictTo('Student'),
    upload.uploadCertificate.single('certificate'),
    moderationController.submitRequest
);

// 2. Nút thắt dành riêng cho Mod / Admin
router.use(authMiddleware.restrictTo('Mod', 'Admin'));

// Quản lý Đơn Giảng viên
router.get('/instructor-requests', moderationController.getPendingInstructorRequests);
router.get('/instructor-requests/:id', moderationController.getRequestDetail);
router.put('/instructor-requests/:requestId/review', moderationController.reviewInstructorRequest);

// Quản lý Khóa học
router.get('/pending-courses', moderationController.getPendingCourses);
router.get('/courses/:courseId', moderationController.getCourseDetail);
router.put('/courses/:courseId/review', moderationController.reviewCourse);

// Admin cập nhật nội dung HTML mới cho điều khoản
router.patch('/settings/instructor-terms', authMiddleware.restrictTo('Admin'), moderationController.updateTerms);

module.exports = router;