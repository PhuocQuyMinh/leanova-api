const AppError = require('../../core/utils/appError');
const Testimonial = require('./testimonial.model');
const User = require('../users/user.model');
const { Op } = require('sequelize');

// ==========================================
// 1. Học viên gửi đánh giá mới cho nền tảng
// ==========================================
exports.createTestimonial = async (userId, data) => {
    const { content, rating } = data;

    // Validate cơ bản
    if (!content) {
        throw new AppError('Nội dung đánh giá không được để trống!', 400);
    }

    const newTestimonial = await Testimonial.create({
        userId,
        content,
        rating,
        status: 'Pending'
    });

    // (Tuỳ chọn) Nếu bạn có hệ thống thông báo, có thể gọi notifService ở đây 
    // để báo cho Admin biết có đánh giá mới cần duyệt (Tương tự tạo khóa học mới).

    return newTestimonial;
};

// ==========================================
// 2. Lấy danh sách đánh giá cho Landing Page (Chỉ Approved)
// ==========================================
exports.getPublicTestimonials = async (page = 1, limit = 10) => {
    const offset = (page - 1) * limit;

    const { count, rows } = await Testimonial.findAndCountAll({
        where: { status: 'Approved' },
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        include: [
            {
                model: User,
                as: 'user',
                attributes: ['id', 'fullName', 'avatarUrl'] // Chỉ lấy những thông tin cần thiết để hiển thị
            }
        ]
    });

    return {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page, 10),
        testimonials: rows
    };
};

// ==========================================
// 3. Admin lấy danh sách toàn bộ đánh giá để kiểm duyệt
// ==========================================
exports.getAdminTestimonials = async (status, page = 1, limit = 10) => {
    const offset = (page - 1) * limit;

    // Nếu Client có gửi status lên thì filter, không thì lấy tất cả
    const whereCondition = status ? { status } : {};

    const { count, rows } = await Testimonial.findAndCountAll({
        where: whereCondition,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        include: [
            {
                model: User,
                as: 'user',
                attributes: ['id', 'fullName', 'email']
            }
        ]
    });

    return {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page, 10),
        testimonials: rows
    };
};

// ==========================================
// 4. Admin duyệt hoặc từ chối đánh giá
// ==========================================
exports.updateStatus = async (id, newStatus) => {
    const testimonial = await Testimonial.findByPk(id);

    if (!testimonial) {
        throw new AppError('Không tìm thấy bài đánh giá!', 404);
    }

    // Kiểm tra trạng thái hợp lệ để tránh lỗi dữ liệu ENUM
    const validStatuses = ['Pending', 'Approved', 'Rejected'];
    if (!validStatuses.includes(newStatus)) {
        throw new AppError('Trạng thái không hợp lệ!', 400);
    }

    // Dùng .update() thay vì gán tay rồi save() để tối ưu và nhất quán với code cũ
    await testimonial.update({ status: newStatus });

    return testimonial;
};