const User = require('./user.model');
const AppError = require('../../core/utils/appError');
const notifService = require('../notifications/notification.service'); // [MỚI] Thêm dòng này
const Course = require('../courses/course.model');
const Enrollment = require('../store/enrollment.model');
const Review = require('../courses/review.model');

// API lấy thông tin giới thiệu giảng viên công khai
exports.getInstructorProfile = async (instructorId) => {
    const instructor = await User.findOne({
        where: { id: instructorId, role: 'Instructor' },
        attributes: ['id', 'fullName', 'email', 'avatarUrl', 'bio']
    });

    if (!instructor) throw new AppError('Không tìm thấy giảng viên!', 404);

    const courseIds = await Course.findAll({
        where: { instructorId },
        attributes: ['id']
    });

    const courseIdList = courseIds.map(course => course.id);
    const coursesCount = courseIdList.length;

    const studentCount = courseIdList.length > 0
        ? await Enrollment.count({
            where: { courseId: courseIdList },
            distinct: true,
            col: 'userId'
        })
        : 0;

    const reviewCount = courseIdList.length > 0
        ? await Review.count({ where: { courseId: courseIdList } })
        : 0;

    return {
        id: instructor.id,
        fullName: instructor.fullName,
        email: instructor.email,
        avatarUrl: instructor.avatarUrl,
        bio: instructor.bio,
        coursesCount,
        studentCount,
        reviewCount
    };
};

// 1. Khóa tài khoản
exports.lockAccount = async (targetUserId, lockReason) => {
    const user = await User.findByPk(targetUserId);
    if (!user) throw new AppError('Không tìm thấy người dùng này!', 404);

    // Luật bất thành văn: Không ai được phép khóa Admin
    if (user.role === 'Admin') {
        throw new AppError('Lỗi bảo mật: Không thể khóa tài khoản Quản trị viên!', 403);
    }

    if (!lockReason || lockReason.trim() === '') {
        throw new AppError('Vui lòng cung cấp lý do khóa để thông báo cho người dùng!', 400);
    }

    user.isActive = false;
    user.lockReason = lockReason;
    await user.save();

    // ==========================================
    // [MỚI] GỬI EMAIL THÔNG BÁO KHÓA TÀI KHOẢN
    // ==========================================
    try {
        await notifService.pushNotification({
            userId: user.id,
            title: 'THÔNG BÁO QUAN TRỌNG: Tài khoản của bạn đã bị khóa',
            message: `Tài khoản của bạn trên hệ thống Leanova đã bị tạm khóa bởi Ban Quản Trị. Lý do: "${lockReason}". Nếu bạn cho rằng đây là một sự nhầm lẫn, vui lòng liên hệ bộ phận hỗ trợ qua email support@leanova.com để được giải quyết.`,
            type: 'System', // Loại thông báo hệ thống
            actionUrl: '/contact-support', // Link dẫn ra trang liên hệ (vì user không còn đăng nhập được)
            isSendEmail: true // BẮT BUỘC gửi email vì user đã bị khóa, không thể vào app đọc quả chuông
        });
    } catch (notifError) {
        // Cô lập lỗi: Nếu SMTP hỏng thì tài khoản vẫn bị khóa thành công trong DB
        console.error('Lỗi khi gửi email thông báo khóa tài khoản cho user:', notifError);
    }
    // ==========================================

    return user;
};

// 2. Mở khóa tài khoản (Khoan hồng)
exports.unlockAccount = async (targetUserId) => {
    const user = await User.findByPk(targetUserId);
    if (!user) throw new AppError('Không tìm thấy người dùng này!', 404);

    user.isActive = true;
    user.lockReason = null; // Xóa án tích
    await user.save();

    return user;
};