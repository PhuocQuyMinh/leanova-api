const express = require('express');
const moderationController = require('./moderation.controller');
const authMiddleware = require('../../core/middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware.protect); // Yêu cầu đăng nhập

// 1. Nút thắt dành cho Học viên (Student) nộp đơn
// Chỉ Student mới nộp được đơn, Giảng viên rồi thì không nộp nữa
router.post('/apply-instructor', authMiddleware.restrictTo('Student'), moderationController.applyForInstructor);

// 2. Nút thắt dành riêng cho Mod / Admin
router.use(authMiddleware.restrictTo('Mod', 'Admin'));

// Quản lý Đơn Giảng viên
router.get('/instructor-requests', moderationController.getPendingInstructorRequests);
router.put('/instructor-requests/:requestId/review', moderationController.reviewInstructorRequest);

// Quản lý Khóa học
router.get('/pending-courses', moderationController.getPendingCourses);
router.put('/courses/:courseId/review', moderationController.reviewCourse);

module.exports = router;