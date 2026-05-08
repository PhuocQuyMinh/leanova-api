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

// Cập nhật câu hỏi và câu trả lời 
router.put('/questions/:questionId', qaController.updateQuestion);
router.put('/answers/:answerId', qaController.updateAnswer);

// NHÓM TÍNH NĂNG CỦA GIÁO VIÊN:

router.get(
    '/instructor/unresolved',
    authMiddleware.restrictTo('Instructor'),
    qaController.getInstructorUnresolvedQuestions
);

// 5. Nhóm Yêu cầu xóa (Dành cho Giảng viên)
router.post('/questions/:questionId/delete-request', authMiddleware.restrictTo('Instructor'), qaController.requestDeleteQuestion);


// ==========================================
// NHÓM API DÀNH CHO KIỂM DUYỆT VIÊN (MOD/ADMIN)
// ==========================================
router.use(authMiddleware.restrictTo('Mod', 'Admin'));

// Xem danh sách các bài bị report yêu cầu xóa
router.get('/mod/pending-deletions', qaController.getPendingDeletionQuestions);

// Quyết định Xóa hoặc Không xóa
router.patch('/mod/questions/:questionId/handle-delete', qaController.handleDeleteRequest);

module.exports = router;