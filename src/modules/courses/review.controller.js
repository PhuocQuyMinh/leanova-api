const reviewService = require('./review.service');
const catchAsync = require('../../core/utils/catchAsync');

exports.addReview = catchAsync(async (req, res, next) => {
    const { rating, comment } = req.body;
    const result = await reviewService.addOrUpdateReview(req.user.id, req.params.courseId, rating, comment);
    res.status(200).json({ status: 'success', data: result });
});

// review.controller.js
exports.getCourseReviews = catchAsync(async (req, res, next) => {
    // req.params.courseId lấy từ URL (VD: /api/courses/10/reviews)
    // req.query chứa các query string (VD: ?mode=highlights hoặc ?page=2&limit=5)

    const data = await reviewService.getCourseReviews(req.params.courseId, req.query);

    res.status(200).json({
        status: 'success',
        data: data
    });
});

// [HỌC VIÊN] Xóa đánh giá của chính mình
exports.deleteReview = catchAsync(async (req, res, next) => {
    const result = await reviewService.deleteReview(req.user.id, req.params.id);

    res.status(200).json({
        status: 'success',
        message: result.message
    });
});