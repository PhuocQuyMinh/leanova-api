const reviewService = require('./review.service');
const catchAsync = require('../../core/utils/catchAsync');

exports.addReview = catchAsync(async (req, res, next) => {
    const { rating, comment } = req.body;
    const result = await reviewService.addOrUpdateReview(req.user.id, req.params.courseId, rating, comment);
    res.status(200).json({ status: 'success', data: result });
});

exports.getCourseReviews = catchAsync(async (req, res, next) => {
    const reviews = await reviewService.getCourseReviews(req.params.courseId);
    res.status(200).json({ status: 'success', results: reviews.length, data: { reviews } });
});

// [HỌC VIÊN] Xóa đánh giá của chính mình
exports.deleteReview = catchAsync(async (req, res, next) => {
    const result = await reviewService.deleteReview(req.user.id, req.params.id);

    res.status(200).json({
        status: 'success',
        message: result.message
    });
});