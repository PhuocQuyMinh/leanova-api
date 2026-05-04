const storeService = require('./store.service');
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
    const result = await storeService.checkout(req.user.id);
    res.status(200).json({ status: 'success', message: result.message });
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