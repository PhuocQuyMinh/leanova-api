const express = require('express');
const qaController = require('./qa.controller');
const authMiddleware = require('../../core/middlewares/auth.middleware');

const router = express.Router();

// Tất cả thao tác Q&A đều yêu cầu đăng nhập
router.use(authMiddleware.protect);

// 1. Nhóm thao tác với Bài học (Hỏi & Xem câu hỏi)
router.post('/lessons/:lessonId/questions', qaController.askQuestion);
router.get('/lessons/:lessonId/questions', qaController.getLessonQuestions);

// 2. Nhóm thao tác với Câu hỏi (Trả lời & Resolve)
router.post('/questions/:questionId/answers', qaController.answerQuestion);
router.patch('/questions/:questionId/resolve', qaController.markAsResolved);

router.get(
    '/instructor/unresolved',
    authMiddleware.restrictTo('Instructor'),
    qaController.getInstructorUnresolvedQuestions
);

module.exports = router;