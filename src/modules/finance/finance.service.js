const AppError = require('../../core/utils/appError');
const sequelize = require('../../core/database/init.mysql');
const { Op } = require('sequelize');
const OrderItem = require('./order_item.model');
const Order = require('../store/order.model');
const WithdrawalRequest = require('./withdrawal_request.model');
const InstructorSetting = require('./instructor_setting.model');
const SystemSetting = require('./system_setting.model');
const notifService = require('../notifications/notification.service'); // [MỚI] Thêm dòng này
const User = require('../users/user.model');

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

// ==========================================
// NHÓM API DÀNH CHO ADMIN QUẢN LÝ TÀI CHÍNH
// ==========================================

// 7. Lấy danh sách tất cả yêu cầu rút tiền của hệ thống (Có thể lọc theo status)
exports.getAllWithdrawalRequests = async (query) => {
    const { status } = query;
    const whereClause = status ? { status } : {}; // Nếu có truyền query ?status=Pending thì lọc, không thì lấy hết

    return await WithdrawalRequest.findAll({
        where: whereClause,
        order: [['createdAt', 'ASC']] // Sắp xếp cũ nhất lên đầu để ưu tiên xử lý trước
    });
};

// 8. Duyệt / Từ chối yêu cầu rút tiền
exports.reviewWithdrawalRequest = async (requestId, status, adminNote) => {
    const request = await WithdrawalRequest.findByPk(requestId);

    if (!request) {
        throw new AppError('Không tìm thấy lệnh rút tiền này!', 404);
    }

    // Kiểm tra đầu vào hợp lệ
    const validStatuses = ['Approved', 'Completed', 'Rejected'];
    if (!validStatuses.includes(status)) {
        throw new AppError('Trạng thái không hợp lệ! Chỉ nhận: Approved, Completed, Rejected.', 400);
    }

    // Ràng buộc bảo mật 1: Đã xong hoặc đã hủy thì không được sửa lại
    if (request.status === 'Completed' || request.status === 'Rejected') {
        throw new AppError(`Không thể can thiệp! Lệnh này đã ở trạng thái: ${request.status}`, 400);
    }

    // Ràng buộc bảo mật 2: Nếu từ chối, bắt buộc phải ghi chú lý do cho giảng viên biết
    if (status === 'Rejected' && (!adminNote || adminNote.trim() === '')) {
        throw new AppError('Vui lòng cung cấp lý do từ chối (adminNote) để giảng viên sửa lại!', 400);
    }

    // Cập nhật dữ liệu
    request.status = status;
    if (adminNote) {
        request.adminNote = adminNote;
    }

    await request.save();

    // ==========================================
    // [MỚI] GỬI THÔNG BÁO CHO GIẢNG VIÊN
    // ==========================================
    try {
        let notifTitle = '';
        let notifMessage = '';
        const formattedAmount = request.amount.toLocaleString('vi-VN');

        // Phân loại nội dung theo trạng thái xử lý
        if (status === 'Approved') {
            notifTitle = 'Yêu cầu rút tiền đã được duyệt';
            notifMessage = `Yêu cầu rút ${formattedAmount} VNĐ của bạn đã được ban quản trị phê duyệt. Chúng tôi đang tiến hành thủ tục chuyển khoản vào ngân hàng của bạn.`;
        } else if (status === 'Completed') {
            notifTitle = '💰 Giải ngân thành công';
            notifMessage = `Số tiền ${formattedAmount} VNĐ đã được chuyển khoản thành công. Vui lòng kiểm tra số dư trong ứng dụng ngân hàng của bạn.`;
        } else if (status === 'Rejected') {
            notifTitle = '❌ Yêu cầu rút tiền bị từ chối';
            notifMessage = `Yêu cầu rút ${formattedAmount} VNĐ của bạn đã bị từ chối. Lý do từ Admin: "${adminNote}". Vui lòng kiểm tra lại thông tin ngân hàng hoặc liên hệ bộ phận hỗ trợ.`;
        }

        if (notifTitle) {
            await notifService.pushNotification({
                userId: request.instructorId, // ID giảng viên gửi lệnh rút
                title: notifTitle,
                message: notifMessage,
                type: 'Payment', // Loại thông báo: Tài chính/Thanh toán
                actionUrl: '/instructor/revenue', // Link dẫn giảng viên về trang Quản lý doanh thu
                isSendEmail: true // Bắt buộc bắn mail để đối soát
            });
        }
    } catch (notifError) {
        // Bọc trong try/catch để nếu SMTP (server mail) chết thì API duyệt tiền của Admin vẫn chạy thành công
        console.error(`Lỗi gửi thông báo khi xử lý rút tiền (Status: ${status}):`, notifError);
    }
    // ==========================================

    return request;
};

// finance.service.js

// [MỚI] Lấy tỉ lệ ăn chia toàn hệ thống (Dành cho Admin xem hoặc Frontend hiển thị)
exports.getGlobalCommission = async () => {
    // Tìm kiếm trong bảng SystemSetting
    const globalSetting = await SystemSetting.findByPk('DEFAULT_COMMISSION_RATE');

    // Nếu có dữ liệu thì ép kiểu sang Float, nếu không có thì trả về mặc định 0.7 (70%)
    const defaultRate = globalSetting ? parseFloat(globalSetting.value) : 0.7;

    return defaultRate;
};

// [MỚI] Thống kê tài chính toàn nền tảng (Cho Admin)
exports.getPlatformStats = async (queryData) => {
    const { startDate, endDate } = queryData;

    // Điều kiện lọc: Chỉ tính các đơn hàng đã thanh toán thành công
    const orderWhereClause = { status: 'Success' };

    // Nếu Admin muốn lọc theo khoảng thời gian
    if (startDate && endDate) {
        orderWhereClause.createdAt = {
            [Op.between]: [new Date(startDate), new Date(endDate)]
        };
    }

    // 1. TỔNG GIÁ TRỊ GIAO DỊCH (GMV)
    // Tính tổng cột 'amount' trong bảng Order
    const totalTransactionValue = await Order.sum('amount', {
        where: orderWhereClause
    }) || 0;

    // 2. LỢI NHUẬN THỰC TẾ CỦA HỆ THỐNG
    // Lợi nhuận = Tổng của (Giá bán khóa học - Tiền chia cho giảng viên)
    // Ta dùng sequelize.literal để trừ trực tiếp 2 cột trong DB cho tốc độ nhanh nhất
    const profitResult = await OrderItem.findAll({
        include: [{
            model: Order,
            attributes: [], // Không cần lấy data của Order, chỉ dùng để JOIN và WHERE
            where: orderWhereClause
        }],
        attributes: [
            [
                sequelize.fn('SUM', sequelize.literal('priceAtPurchase - instructorEarnings')),
                'platformProfit'
            ]
        ],
        raw: true
    });

    const platformProfit = profitResult[0].platformProfit ? parseInt(profitResult[0].platformProfit) : 0;

    return {
        totalTransactionValue,
        platformProfit,
        // Tiện tay tính luôn tiền giảng viên nhận được để Admin nhìn tổng quan
        totalInstructorEarnings: totalTransactionValue - platformProfit,
        period: startDate && endDate ? `${startDate} - ${endDate}` : 'Toàn thời gian'
    };
};

// [MỚI] Lấy Top 3 Giảng viên có doanh thu cao nhất
exports.getTopInstructors = async () => {
    return await OrderItem.findAll({
        attributes: [
            'instructorId',
            [sequelize.fn('SUM', sequelize.col('priceAtPurchase')), 'totalSales'],
            [sequelize.fn('COUNT', sequelize.col('OrderItem.id')), 'courseSold']
        ],
        include: [
            {
                model: Order,
                where: { status: 'Success' }, // Chỉ tính các đơn đã thanh toán thành công
                attributes: [] // Không lấy dữ liệu bảng Order
            },
            {
                model: User, // Liên kết sang bảng User để lấy tên
                attributes: ['id', 'fullName', 'avatarUrl']
            }
        ],
        group: ['instructorId'], // Nhóm theo từng giảng viên
        order: [[sequelize.literal('totalSales'), 'DESC']], // Sắp xếp doanh thu giảm dần
        limit: 3 // Chỉ lấy 3 người đầu bảng
    });
};