const AppError = require('../../core/utils/appError');
const sequelize = require('../../core/database/init.mysql');
const { Op } = require('sequelize');
const OrderItem = require('./order_item.model');
const Order = require('../store/order.model');
const WithdrawalRequest = require('./withdrawal_request.model');
const InstructorSetting = require('./instructor_setting.model');

// 1. Lấy thông số Tổng quan (Doanh thu & Số dư)
exports.getDashboardStats = async (instructorId) => {
    // 1.1 Tính Tổng doanh thu (Chỉ tính các Order đã thanh toán thành công)
    const totalRevenueResult = await OrderItem.sum('instructorEarnings', {
        where: { instructorId },
        include: [{
            model: Order,
            where: { status: 'Success' },
            attributes: []
        }]
    });
    const totalRevenue = totalRevenueResult || 0;

    // 1.2 Tính Tổng tiền đã rút HOẶC đang chờ rút (Pending, Approved, Completed)
    const totalWithdrawnResult = await WithdrawalRequest.sum('amount', {
        where: {
            instructorId,
            status: { [Op.in]: ['Pending', 'Approved', 'Completed'] }
        }
    });
    const totalWithdrawn = totalWithdrawnResult || 0;

    // 1.3 Số dư khả dụng
    const availableBalance = totalRevenue - totalWithdrawn;

    return {
        totalRevenue,
        availableBalance,
        totalWithdrawn
    };
};

// 2. Tạo lệnh rút tiền
exports.createWithdrawalRequest = async (instructorId, amount) => {
    // Ép kiểu để tính toán chính xác
    const requestAmount = parseInt(amount);
    if (requestAmount < 100000) {
        throw new AppError('Số tiền rút tối thiểu là 100,000 VND', 400);
    }

    // Lấy thông tin STK của giảng viên
    const setting = await InstructorSetting.findOne({ where: { userId: instructorId } });
    if (!setting || !setting.bankName || !setting.bankAccount) {
        throw new AppError('Vui lòng cập nhật thông tin Ngân hàng trước khi rút tiền!', 400);
    }

    // Dùng Transaction để tránh lỗi race condition (Bấm rút 2 lần cùng lúc)
    const transaction = await sequelize.transaction();

    try {
        // Kiểm tra lại số dư thực tế
        const stats = await exports.getDashboardStats(instructorId);

        if (stats.availableBalance < requestAmount) {
            throw new AppError(`Số dư khả dụng không đủ! Bạn chỉ có thể rút tối đa ${stats.availableBalance.toLocaleString()} VND.`, 400);
        }

        // Tạo lệnh rút
        const snapshot = `Ngân hàng: ${setting.bankName} | STK: ${setting.bankAccount} | Tên: ${setting.accountName}`;
        const request = await WithdrawalRequest.create({
            instructorId,
            amount: requestAmount,
            bankInfoSnapshot: snapshot
        }, { transaction });

        await transaction.commit();
        return request;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

// 3. Lấy lịch sử rút tiền
exports.getWithdrawalHistory = async (instructorId) => {
    return await WithdrawalRequest.findAll({
        where: { instructorId },
        order: [['createdAt', 'DESC']]
    });
};

// 4. API Lấy dữ liệu Biểu đồ (Nhóm theo ngày trong 30 ngày qua)
exports.getRevenueChart = async (instructorId) => {
    // Dùng RAW SQL Query của Sequelize để group by ngày (MySQL function DATE())
    const chartData = await OrderItem.findAll({
        where: { instructorId },
        include: [{
            model: Order,
            where: { status: 'Success' },
            attributes: []
        }],
        attributes: [
            [sequelize.fn('DATE', sequelize.col('OrderItem.createdAt')), 'date'],
            [sequelize.fn('SUM', sequelize.col('instructorEarnings')), 'dailyRevenue']
        ],
        group: [sequelize.fn('DATE', sequelize.col('OrderItem.createdAt'))],
        order: [[sequelize.fn('DATE', sequelize.col('OrderItem.createdAt')), 'ASC']]
    });

    return chartData;
};