const courseService = require('./course.service');
const catchAsync = require('../../core/utils/catchAsync');

exports.createCourse = catchAsync(async (req, res, next) => {
    // Gọi service, truyền vào dữ liệu từ body và ID của giảng viên (lấy từ req.user do middleware protect tạo ra)
    const newCourse = await courseService.createCourse(req.body, req.user.id);

    res.status(201).json({
        status: 'success',
        message: 'Tạo khóa học thành công, vui lòng chờ kiểm duyệt!',
        data: { course: newCourse }
    });
});

exports.getMyCourses = catchAsync(async (req, res, next) => {
    const courses = await courseService.getInstructorCourses(req.user.id);

    res.status(200).json({
        status: 'success',
        results: courses.length,
        data: { courses }
    });
});