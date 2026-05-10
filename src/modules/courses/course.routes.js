const express = require('express');
const courseController = require('./course.controller');
const authMiddleware = require('../../core/middlewares/auth.middleware');
const upload = require('../../core/middlewares/upload.middleware'); // Import multer

const router = express.Router();
const reviewController = require('./review.controller');

// Public: Ai cũng xem được review
router.get('/:courseId/reviews', reviewController.getCourseReviews);

// Lớp bảo vệ 1: Phải đăng nhập
router.use(authMiddleware.protect);

// Protected: Phải đăng nhập (và Service đã chặn việc chưa mua khóa học)
router.post('/:courseId/reviews', authMiddleware.protect, reviewController.addReview);
router.delete('reviews/:id', reviewController.deleteReview);

router.use(authMiddleware.restrictTo('Instructor', 'Admin')); // Chỉ Giảng viên/Admin dùng router này

// Quản lý khóa học
router.post('/', courseController.createCourse);
router.get('/my-courses', courseController.getMyCourses);
router.put('/:id', upload.uploadAttachment.single('coverImage'), courseController.updateCourse);

// Biên tập nội dung
// Chương
router.post('/:courseId/sections', courseController.addSection);
router.put('/sections/:sectionId', courseController.updateSection);
router.post('/sections/:sectionId/quizzes', courseController.addQuiz);

// Lesson
router.post('/sections/:sectionId/lessons', upload.uploadVideo.single('video'), courseController.addLesson);
router.put('/lessons/:lessonId', upload.uploadVideo.single('video'), courseController.updateLesson);

// Attachment
router.post('/lessons/:lessonId/attachments', upload.uploadAttachment.single('file'), courseController.addAttachment);
router.put('/attachments/:attachmentId', upload.uploadAttachment.single('file'), courseController.updateAttachment);

// Lưu lại vị trí khi kéo thả (Kéo thả áp dụng cho toàn bộ khóa học)
router.patch('/:courseId/curriculum/reorder', courseController.reorderCurriculum);

// Biên tập Nội dung Bài Trắc nghiệm (Quiz)
router.post('/quizzes/:quizId/questions', courseController.addQuizQuestion);

module.exports = router;