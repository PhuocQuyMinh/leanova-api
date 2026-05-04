const Course = require('../courses/course.model');
const Section = require('../courses/section.model');
const Lesson = require('../courses/lesson.model');
const User = require('../users/user.model');
const InstructorRequest = require('./instructor_request.model');
const sequelize = require('../../core/database/init.mysql');
const AppError = require('../../core/utils/appError');

// ==========================================
// LUỒNG 1: DUYỆT KHÓA HỌC
// ==========================================

// 1.1 Lấy danh sách khóa học chờ duyệt (Kèm theo thông tin Giảng viên & Số lượng chương)
exports.getPendingCourses = async () => {
    return await Course.findAll({
        where: { status: 'Pending' },
        include: [
            { model: User, as: 'instructor', attributes: ['id', 'fullName', 'email'] },
            { model: Section, as: 'sections', attributes: ['id', 'title'] }
        ],
        order: [['createdAt', 'ASC']] // Ai nộp trước duyệt trước (FIFO)
    });
};

// 1.2 Quyết định Duyệt hoặc Từ chối khóa học
exports.reviewCourse = async (courseId, action, rejectMessage = '') => {
    const course = await Course.findByPk(courseId);
    if (!course) throw new AppError('Không tìm thấy khóa học!', 404);
    if (course.status !== 'Pending') throw new AppError('Khóa học này đã được xử lý rồi!', 400);

    if (action === 'Approve') {
        course.status = 'Published';
        course.rejectMessage = null; // Xóa lỗi cũ nếu có
    } else if (action === 'Reject') {
        if (!rejectMessage) throw new AppError('Bắt buộc phải nhập lý do từ chối!', 400);
        course.status = 'Rejected';
        course.rejectMessage = rejectMessage;
    } else {
        throw new AppError('Hành động không hợp lệ (Chỉ Approve hoặc Reject)', 400);
    }

    await course.save();
    return course;
};

// ==========================================
// LUỒNG 2: DUYỆT GIẢNG VIÊN (SỬ DỤNG TRANSACTION)
// ==========================================

// 2.1 Học viên nộp đơn đăng ký
exports.createInstructorRequest = async (userId, requestData) => {
    // Kiểm tra xem có đơn nào đang Pending không, tránh spam
    const existingRequest = await InstructorRequest.findOne({ where: { userId, status: 'Pending' } });
    if (existingRequest) throw new AppError('Bạn đang có một đơn chờ duyệt rồi!', 400);

    return await InstructorRequest.create({
        userId,
        bio: requestData.bio,
        experience: requestData.experience
    });
};

// 2.2 Mod lấy danh sách đơn chờ duyệt
exports.getPendingInstructorRequests = async () => {
    return await InstructorRequest.findAll({
        where: { status: 'Pending' },
        include: [{ model: User, as: 'applicant', attributes: ['id', 'fullName', 'email'] }],
        order: [['createdAt', 'ASC']]
    });
};

// 2.3 Mod xử lý đơn (Kỹ thuật Transaction)
exports.reviewInstructorRequest = async (requestId, action, rejectReason = '') => {
    // Khởi tạo Transaction
    const t = await sequelize.transaction();

    try {
        const request = await InstructorRequest.findByPk(requestId, { transaction: t });
        if (!request) throw new AppError('Không tìm thấy đơn đăng ký!', 404);
        if (request.status !== 'Pending') throw new AppError('Đơn này đã được xử lý!', 400);

        if (action === 'Reject') {
            if (!rejectReason) throw new AppError('Bắt buộc phải nhập lý do từ chối!', 400);
            request.status = 'Rejected';
            request.rejectReason = rejectReason;
            // Write 'reject status' to db
            await request.save({ transaction: t });
        }

        else if (action === 'Approve') {
            // 1. Đổi trạng thái đơn
            request.status = 'Approved';

            // Write 'approved status' to db            
            await request.save({ transaction: t });

            // 2. Nâng cấp Role cho User
            const user = await User.findByPk(request.userId, { transaction: t });
            user.role = 'Instructor';
            await user.save({ transaction: t });
        }

        // Nếu mọi thứ chạy êm đẹp, Commit lưu vào DB
        await t.commit();
        return request;

    } catch (error) {
        // Nếu có bất kỳ lỗi gì ở trên, Rollback toàn bộ, coi như chưa có chuyện gì xảy ra
        await t.rollback();
        throw error;
    }
};