const storeService = require('./store.service');
const searchService = require('./search.service');
const catchAsync = require('../../core/utils/catchAsync');

exports.getPublishedCourses = catchAsync(async (req, res, next) => {
    const courses = await storeService.getPublishedCourses();
    res.status(200).json({ status: 'success', results: courses.length, data: { courses } });
});

exports.getCourseDetailPublic = catchAsync(async (req, res, next) => {
    const course = await storeService.getCourseDetailPublic(req.params.id);
    res.status(200).json({ status: 'success', data: { course } });
});

exports.addToCart = catchAsync(async (req, res, next) => {
    await storeService.addToCart(req.user.id, req.body.courseId);
    res.status(201).json({ status: 'success', message: 'Đã thêm vào giỏ hàng!' });
});

exports.getMyCart = catchAsync(async (req, res, next) => {
    const cart = await storeService.getMyCart(req.user.id);
    res.status(200).json({ status: 'success', data: { cart } });
});

exports.checkout = catchAsync(async (req, res, next) => {
    // VNPay yêu cầu truyền IP của máy người mua
    let ipAddr = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';

    const result = await storeService.checkout(req.user.id, ipAddr);
    res.status(200).json({
        status: 'success',
        message: 'Vui lòng thanh toán qua link đính kèm',
        data: { paymentUrl: result.paymentUrl }
    });
});

exports.getMyEnrollments = catchAsync(async (req, res, next) => {
    const enrollments = await storeService.getMyEnrollments(req.user.id);
    res.status(200).json({ status: 'success', results: enrollments.length, data: { enrollments } });
});

exports.getEnrolledCourseDetail = catchAsync(async (req, res, next) => {
    // Truyền cả ID của Học viên đang đăng nhập và ID khóa học họ muốn xem
    const course = await storeService.getEnrolledCourseDetail(req.user.id, req.params.courseId);
    res.status(200).json({ status: 'success', data: { course } });
});

exports.toggleLessonComplete = catchAsync(async (req, res, next) => {
    const { courseId, lessonId } = req.params;
    const result = await storeService.toggleLessonComplete(req.user.id, courseId, lessonId);

    res.status(200).json({ status: 'success', data: result });
});

exports.submitQuiz = catchAsync(async (req, res, next) => {
    // req.body.answers là mảng đáp án
    const result = await storeService.submitQuiz(req.user.id, req.params.quizId, req.body.answers);
    res.status(200).json({ status: 'success', data: result });
});

// Thêm hàm xử lý Return
exports.vnpayReturn = catchAsync(async (req, res, next) => {
    const result = await storeService.vnpayReturn(req.query); // VNPay trả data qua query string
    if (result.code == "00") {
        //return res.redirect('http://localhost:3000/payment/result?status=success');
    }
    else {
        //return res.redirect('http://localhost:3000/payment/result?status=failed');
    }
    res.status(200).json({ status: 'success', data: result });
});

// [MỚI] Xóa khóa học khỏi giỏ
exports.removeFromCart = catchAsync(async (req, res, next) => {
    // req.user.id có được từ middleware auth.protect
    // req.params.courseId lấy từ URL (VD: DELETE /api/cart/15)
    await storeService.removeFromCart(req.user.id, req.params.courseId);

    // Trả về status 204 No Content (chuẩn RESTful API cho tác vụ xóa thành công)
    res.status(204).json({
        status: 'success',
        data: null
    });
});

exports.toggleFavorite = catchAsync(async (req, res, next) => {
    const result = await storeService.toggleFavorite(req.user.id, req.params.courseId);
    res.status(200).json({ status: 'success', data: result });
});

exports.getMyFavorites = catchAsync(async (req, res, next) => {
    const favorites = await storeService.getMyFavorites(req.user.id);
    res.status(200).json({ status: 'success', data: { favorites } });
});

exports.searchMyCourses = catchAsync(async (req, res, next) => {
    // req.user.id được lấy từ authMiddleware.protect
    // req.query chứa các tham số từ URL (keyword, minProgress, page...)
    const result = await searchService.searchMyEnrollments(req.user.id, req.query);

    res.status(200).json({
        status: 'success',
        data: result
    });
});