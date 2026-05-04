const Order = require('../store/order.model');
const User = require('../users/user.model');
const Course = require('../courses/course.model');
const Enrollment = require('../store/enrollment.model');
const sequelize = require('../../core/database/init.mysql');
const { Op } = require('sequelize');

exports.getAdminOverview = async () => {
    // 1. Tính tổng doanh thu (Chỉ cộng tiền những đơn đã Success)
    const totalRevenue = await Order.sum('amount', {
        where: { status: 'Success' }
    });

    // 2. Đếm tổng số Học viên và Giảng viên trên nền tảng
    const totalStudents = await User.count({ where: { role: 'Student' } });
    const totalInstructors = await User.count({ where: { role: 'Instructor' } });

    // 3. Đếm tổng số khóa học đang xuất bản
    const totalPublishedCourses = await Course.count({ where: { status: 'published' } });

    // 4. Lấy 5 đơn hàng giao dịch thành công mới nhất để hiện lên bảng "Giao dịch gần đây"
    const recentOrders = await Order.findAll({
        where: { status: 'Success' },
        include: [{ model: User, attributes: ['fullName', 'email'] }],
        order: [['updatedAt', 'DESC']],
        limit: 5
    });

    return {
        revenue: totalRevenue || 0,
        users: {
            students: totalStudents,
            instructors: totalInstructors
        },
        courses: totalPublishedCourses,
        recentOrders
    };
};