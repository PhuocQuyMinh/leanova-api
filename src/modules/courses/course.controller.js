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

exports.updateCourse = catchAsync(async (req, res, next) => {
    // req.file do multer tạo ra chứa thông tin file ảnh đã upload
    const updatedCourse = await courseService.updateCourse(req.params.id, req.user.id, req.body, req.file);

    res.status(200).json({
        status: 'success',
        message: 'Cập nhật khóa học thành công!',
        data: { course: updatedCourse }
    });
});

exports.addSection = catchAsync(async (req, res, next) => {
    const newSection = await courseService.addSection(req.params.courseId, req.user.id, req.body);

    res.status(201).json({
        status: 'success',
        data: { section: newSection }
    });
});

exports.updateSection = catchAsync(async (req, res, next) => {
    const updatedSection = await courseService.updateSection(req.params.sectionId, req.user.id, req.body);
    res.status(200).json({
        status: 'success',
        message: 'Cập nhật chương thành công!',
        data: { section: updatedSection }
    });
});

exports.addLesson = catchAsync(async (req, res, next) => {
    const newLesson = await courseService.addLesson(req.params.sectionId, req.user.id, req.body, req.file);
    res.status(201).json({
        status: 'success',
        message: 'Thêm bài học thành công!',
        data: { lesson: newLesson }
    });
});

exports.updateLesson = catchAsync(async (req, res, next) => {
    const updatedLesson = await courseService.updateLesson(req.params.lessonId, req.body, req.file);
    res.status(200).json({
        status: 'success',
        message: 'Cập nhật bài học thành công!',
        data: { lesson: updatedLesson }
    });
});

exports.addAttachment = catchAsync(async (req, res, next) => {
    // Nhận file từ req.file (do multer xử lý) và req.body (nếu có gửi kèm tên)
    const newAttachment = await courseService.addAttachment(req.params.lessonId, req.user.id, req.body, req.file);
    res.status(201).json({
        status: 'success',
        message: 'Đính kèm tài liệu thành công!',
        data: { attachment: newAttachment }
    });
});

exports.updateAttachment = catchAsync(async (req, res, next) => {
    const updatedAttachment = await courseService.updateAttachment(req.params.attachmentId, req.user.id, req.body, req.file);
    res.status(200).json({
        status: 'success',
        message: 'Cập nhật tài liệu thành công!',
        data: { attachment: updatedAttachment }
    });
});

exports.addQuiz = catchAsync(async (req, res, next) => {
    const newQuiz = await courseService.addQuiz(req.params.sectionId, req.user.id, req.body);
    res.status(201).json({
        status: 'success',
        message: 'Tạo bài kiểm tra thành công!',
        data: { quiz: newQuiz }
    });
});