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