const Course = require('./course.model');
const AppError = require('../../core/utils/appError');

// 1. Logic tạo khóa học mới
exports.createCourse = async (courseData, instructorId) => {
    const newCourse = await Course.create({
        title: courseData.title,
        description: courseData.description,
        price: courseData.price,
        instructorId: instructorId // Lấy ID của người đang đăng nhập gắn vào khóa học
    });

    return newCourse;
};

// 2. Logic lấy danh sách khóa học do chính giảng viên đó tạo
exports.getInstructorCourses = async (instructorId) => {
    const courses = await Course.findAll({
        where: { instructorId: instructorId },
        order: [['createdAt', 'DESC']] // Sắp xếp khóa học mới nhất lên đầu
    });

    return courses;
};