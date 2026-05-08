const AppError = require('../../core/utils/appError');
const sequelize = require('../../core/database/init.mysql');
const { Op } = require('sequelize');
const OrderItem = require('./order_item.model');
const Order = require('../store/order.model');
const WithdrawalRequest = require('./withdrawal_request.model');
const InstructorSetting = require('./instructor_setting.model');
const SystemSetting = require('./system_setting.model');

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

// ... (các hàm cũ: getDashboardStats, createWithdrawalRequest, ...)

// 5. Lấy thông tin cấu hình tài khoản của Giảng viên (STK, % hoa hồng)
exports.getInstructorSettings = async (instructorId) => {
    const settings = await InstructorSetting.findByPk(instructorId);

    if (!settings) {
        // [CẬP NHẬT] Lấy cấu hình từ DB thay vì hardcode 0.7
        const globalSetting = await SystemSetting.findByPk('DEFAULT_COMMISSION_RATE');
        const defaultRate = globalSetting ? parseFloat(globalSetting.value) : 0.7;

        // Nếu chưa từng có cấu hình, trả về mặc định để Frontend hiển thị
        return {
            userId: instructorId,
            commissionRate: defaultRate,
            bankName: '',
            bankAccount: '',
            accountName: ''
        };
    }
    return settings;
};

// 6. Cập nhật thông tin ngân hàng
exports.updateBankInfo = async (instructorId, bankData) => {
    const { bankName, bankAccount, accountName } = bankData;

    if (!bankName || !bankAccount || !accountName) {
        throw new AppError('Vui lòng cung cấp đầy đủ tên ngân hàng, số tài khoản và tên chủ tài khoản!', 400);
    }

    // Tìm xem đã có bản ghi chưa
    let settings = await InstructorSetting.findByPk(instructorId);

    if (settings) {
        // Nếu đã có, chỉ cập nhật thông tin ngân hàng (không cho phép GV tự sửa % hoa hồng)
        await settings.update({
            bankName,
            bankAccount,
            accountName
        });
    } else {
        // [CẬP NHẬT] Lấy cấu hình từ DB để gán cho giảng viên mới
        const globalSetting = await SystemSetting.findByPk('DEFAULT_COMMISSION_RATE');
        const defaultRate = globalSetting ? parseFloat(globalSetting.value) : 0.7;

        // Nếu chưa có, tạo mới bản ghi với % hoa hồng lấy từ hệ thống
        settings = await InstructorSetting.create({
            userId: instructorId,
            bankName,
            bankAccount,
            accountName,
            commissionRate: defaultRate
        });
    }

    return settings;
};

// 1. Cập nhật phần trăm ăn chia TOÀN HỆ THỐNG
exports.updateGlobalCommission = async (rate) => {
    if (rate < 0 || rate > 1) {
        throw new AppError('Tỉ lệ ăn chia phải nằm trong khoảng từ 0 đến 1 (VD: 0.75 cho 75%)', 400);
    }

    // Upsert: Cập nhật nếu đã có key này, chưa có thì tạo mới
    const [setting, created] = await SystemSetting.upsert({
        key: 'DEFAULT_COMMISSION_RATE',
        value: rate.toString(),
        description: 'Phần trăm mặc định giảng viên nhận được từ doanh thu'
    });

    return setting;
};

// 2. Cập nhật phần trăm ăn chia RIÊNG cho từng giảng viên
exports.updateInstructorCommission = async (instructorId, rate) => {
    if (rate < 0 || rate > 1) {
        throw new AppError('Tỉ lệ ăn chia phải nằm trong khoảng từ 0 đến 1', 400);
    }

    // Kiểm tra xem giảng viên có tồn tại không (Có thể check qua bảng User)
    // Ở đây ta dùng upsert vào bảng InstructorSetting
    const [setting, created] = await InstructorSetting.upsert({
        userId: instructorId,
        commissionRate: rate
    });

    return setting;
};