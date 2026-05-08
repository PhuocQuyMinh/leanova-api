const qaService = require('./qa.service');
const catchAsync = require('../../core/utils/catchAsync');

exports.askQuestion = catchAsync(async (req, res, next) => {
    const question = await qaService.askQuestion(req.user.id, req.params.lessonId, req.body);
    res.status(201).json({ status: 'success', data: { question } });
});

exports.getLessonQuestions = catchAsync(async (req, res, next) => {
    const questions = await qaService.getLessonQuestions(req.params.lessonId);
    res.status(200).json({ status: 'success', results: questions.length, data: { questions } });
});

exports.answerQuestion = catchAsync(async (req, res, next) => {
    const answer = await qaService.answerQuestion(req.user.id, req.params.questionId, req.body.content);
    res.status(201).json({ status: 'success', data: { answer } });
});

exports.markAsResolved = catchAsync(async (req, res, next) => {
    const question = await qaService.markAsResolved(req.user.id, req.params.questionId);
    res.status(200).json({ status: 'success', message: 'Đã đánh dấu giải quyết', data: { question } });
});

// [MỚI] Lấy danh sách câu hỏi chưa xử lý cho Dashboard Giảng viên
exports.getInstructorUnresolvedQuestions = catchAsync(async (req, res, next) => {
    const questions = await qaService.getInstructorUnresolvedQuestions(req.user.id);

    res.status(200).json({
        status: 'success',
        results: questions.length,
        data: { questions }
    });
});

// [MỚI] Nhóm API Cập nhật & Yêu cầu xóa

exports.updateQuestion = catchAsync(async (req, res, next) => {
    const question = await qaService.updateQuestion(req.user.id, req.params.questionId, req.body);
    res.status(200).json({ status: 'success', data: { question } });
});

exports.updateAnswer = catchAsync(async (req, res, next) => {
    const answer = await qaService.updateAnswer(req.user.id, req.params.answerId, req.body);
    res.status(200).json({ status: 'success', data: { answer } });
});

exports.requestDeleteQuestion = catchAsync(async (req, res, next) => {
    const question = await qaService.requestDeleteQuestion(req.user.id, req.params.questionId, req.body.reason);
    res.status(200).json({
        status: 'success',
        message: 'Đã gửi yêu cầu xóa đến Kiểm duyệt viên thành công!',
        data: { question }
    });
});

// [MOD API] Lấy danh sách chờ xử lý
exports.getPendingDeletionQuestions = catchAsync(async (req, res, next) => {
    const questions = await qaService.getPendingDeletionQuestions();
    res.status(200).json({
        status: 'success',
        results: questions.length,
        data: { questions }
    });
});

// [MOD API] Xử lý yêu cầu
exports.handleDeleteRequest = catchAsync(async (req, res, next) => {
    const { action, modNote } = req.body;
    const result = await qaService.handleDeleteRequest(req.params.questionId, action, modNote);

    res.status(200).json({
        status: 'success',
        message: result.message,
        data: result.question ? { question: result.question } : null
    });
});