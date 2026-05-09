const dashboardService = require('./instructor_dashboard.service');
const catchAsync = require('../../core/utils/catchAsync');

exports.getGlobalStats = catchAsync(async (req, res, next) => {
    const stats = await dashboardService.getGlobalStats(req.user.id);

    res.status(200).json({
        status: 'success',
        data: stats
    });
});

exports.getCourseSpecificStats = catchAsync(async (req, res, next) => {
    const stats = await dashboardService.getCourseSpecificStats(req.user.id, req.params.courseId);

    res.status(200).json({
        status: 'success',
        data: stats
    });
});

exports.getPeriodicStats = catchAsync(async (req, res, next) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return next(new AppError('Vui lòng cung cấp startDate và endDate (YYYY-MM-DD)', 400));
    }

    const stats = await dashboardService.getPeriodicStats(req.user.id, startDate, endDate);

    res.status(200).json({
        status: 'success',
        data: stats
    });
});

// ==========================================
// 2. NHÓM API DÀNH CHO GIẢNG VIÊN
// ==========================================

// Xem danh sách toàn bộ review của các khóa học mình dạy
exports.getInstructorReviews = catchAsync(async (req, res, next) => {
    const reviews = await dashboardService.getInstructorReviews(req.user.id);

    res.status(200).json({
        status: 'success',
        results: reviews.length,
        data: { reviews }
    });
});

// Phản hồi đánh giá của học viên
exports.replyToReview = catchAsync(async (req, res, next) => {
    const { replyContent } = req.body;
    const review = await dashboardService.replyToReview(req.user.id, req.params.id, replyContent);

    res.status(200).json({
        status: 'success',
        message: 'Đã gửi phản hồi cho học viên.',
        data: { review }
    });
});

// Báo cáo đánh giá xấu/spam lên Mod
exports.reportReview = catchAsync(async (req, res, next) => {
    const { reason } = req.body;
    const review = await dashboardService.reportReview(req.user.id, req.params.id, reason);

    res.status(200).json({
        status: 'success',
        message: 'Đã gửi báo cáo cho Kiểm duyệt viên xử lý.',
        data: { review }
    });
});

// ==========================================
// 3. NHÓM API DÀNH CHO KIỂM DUYỆT VIÊN (MOD/ADMIN)
// ==========================================
// Xem danh sách các đánh giá đang bị báo cáo
exports.getReportedReviews = catchAsync(async (req, res, next) => {
    const reviews = await dashboardService.getReportedReviews();

    res.status(200).json({
        status: 'success',
        results: reviews.length,
        data: { reviews }
    });
});

// Quyết định xử lý (Xóa đánh giá hoặc Từ chối báo cáo)
exports.handleReviewReport = catchAsync(async (req, res, next) => {
    const { action, modNote } = req.body;

    const result = await dashboardService.handleReviewReport(req.params.id, action, modNote);

    res.status(200).json({
        status: 'success',
        message: result.message,
        // Trả về userIdToBan nếu hành động là 'delete', ngược lại trả về review đã cập nhật
        data: result
    });
});

// Sửa phản hồi đánh giá
exports.updateReply = catchAsync(async (req, res, next) => {
    const { replyContent } = req.body;

    if (!replyContent || replyContent.trim() === '') {
        return next(new AppError('Nội dung phản hồi không được để trống!', 400));
    }

    const review = await dashboardService.updateReply(req.user.id, req.params.id, replyContent);

    res.status(200).json({
        status: 'success',
        message: 'Đã cập nhật phản hồi thành công.',
        data: { review }
    });
});

// Xóa phản hồi đánh giá
exports.deleteReply = catchAsync(async (req, res, next) => {
    await dashboardService.deleteReply(req.user.id, req.params.id);

    res.status(200).json({
        status: 'success',
        message: 'Đã xóa phản hồi thành công.',
        data: null
    });
});