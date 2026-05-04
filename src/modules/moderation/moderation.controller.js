const moderationService = require('./moderation.service');
const catchAsync = require('../../core/utils/catchAsync');

// --- HỌC VIÊN ---
exports.applyForInstructor = catchAsync(async (req, res, next) => {
    const request = await moderationService.createInstructorRequest(req.user.id, req.body);
    res.status(201).json({ status: 'success', message: 'Nộp đơn thành công. Vui lòng chờ phản hồi!', data: request });
});

// --- MODERATOR ---
exports.getPendingCourses = catchAsync(async (req, res, next) => {
    const courses = await moderationService.getPendingCourses();
    res.status(200).json({ status: 'success', results: courses.length, data: courses });
});

exports.reviewCourse = catchAsync(async (req, res, next) => {
    const { action, rejectMessage } = req.body;
    const course = await moderationService.reviewCourse(req.params.courseId, action, rejectMessage);
    res.status(200).json({ status: 'success', message: `Đã ${action} khóa học thành công!`, data: course });
});

exports.getPendingInstructorRequests = catchAsync(async (req, res, next) => {
    const requests = await moderationService.getPendingInstructorRequests();
    res.status(200).json({ status: 'success', results: requests.length, data: requests });
});

exports.reviewInstructorRequest = catchAsync(async (req, res, next) => {
    const { action, rejectReason } = req.body;
    const request = await moderationService.reviewInstructorRequest(req.params.requestId, action, rejectReason);
    res.status(200).json({ status: 'success', message: `Đã xử lý đơn thành công!`, data: request });
});