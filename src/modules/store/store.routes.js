const express = require('express');
const storeController = require('./store.controller');
const authMiddleware = require('../../core/middlewares/auth.middleware');

const router = express.Router();

// ==========================================
// PUBLIC ROUTES (Khách vãng lai cũng xem được)
// ==========================================
router.get('/courses', storeController.getPublishedCourses);
router.get('/courses/:id', storeController.getCourseDetailPublic);

router.get('/vnpay_return', storeController.vnpayReturn);

// ==========================================
// PROTECTED ROUTES (Phải đăng nhập mới được mua)
// ==========================================
router.use(authMiddleware.protect);

router.get('/cart', storeController.getMyCart);
router.post('/cart', storeController.addToCart);
router.post('/checkout', storeController.checkout);

// ---> NHÓM KHÔNG GIAN HỌC TẬP <---
router.get('/my-learning', storeController.getMyEnrollments);
router.get('/my-learning/:courseId', storeController.getEnrolledCourseDetail);

// [MỚI] API Đánh dấu hoàn thành bài học
router.put('/my-learning/:courseId/lessons/:lessonId/complete', storeController.toggleLessonComplete);

// [MỚI] Nộp bài kiểm tra trắc nghiệm
router.post('/my-learning/quizzes/:quizId/submit', storeController.submitQuiz);

module.exports = router;