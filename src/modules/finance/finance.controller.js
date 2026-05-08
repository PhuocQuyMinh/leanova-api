const financeService = require('./finance.service');
const catchAsync = require('../../core/utils/catchAsync');

exports.getDashboardStats = catchAsync(async (req, res, next) => {
    const stats = await financeService.getDashboardStats(req.user.id);
    res.status(200).json({ status: 'success', data: stats });
});

exports.getRevenueChart = catchAsync(async (req, res, next) => {
    const chartData = await financeService.getRevenueChart(req.user.id);
    res.status(200).json({ status: 'success', data: { chartData } });
});

exports.createWithdrawalRequest = catchAsync(async (req, res, next) => {
    const { amount } = req.body;
    const request = await financeService.createWithdrawalRequest(req.user.id, amount);

    res.status(201).json({
        status: 'success',
        message: 'Tạo lệnh rút tiền thành công. Vui lòng chờ Admin xử lý!',
        data: { request }
    });
});

exports.getWithdrawalHistory = catchAsync(async (req, res, next) => {
    const history = await financeService.getWithdrawalHistory(req.user.id);
    res.status(200).json({ status: 'success', data: { history } });
});

exports.getSettings = catchAsync(async (req, res, next) => {
    const settings = await financeService.getInstructorSettings(req.user.id);
    res.status(200).json({
        status: 'success',
        data: { settings }
    });
});

exports.updateSettings = catchAsync(async (req, res, next) => {
    const settings = await financeService.updateBankInfo(req.user.id, req.body);
    res.status(200).json({
        status: 'success',
        message: 'Cập nhật thông tin tài khoản ngân hàng thành công!',
        data: { settings }
    });
});

// Cập nhật phí toàn hệ thống
exports.updateGlobalCommission = catchAsync(async (req, res, next) => {
    const { rate } = req.body;
    const setting = await financeService.updateGlobalCommission(rate);

    res.status(200).json({
        status: 'success',
        message: 'Đã cập nhật tỉ lệ ăn chia mặc định toàn hệ thống!',
        data: { setting }
    });
});

// Cập nhật phí riêng cho 1 giảng viên
exports.updateInstructorCommission = catchAsync(async (req, res, next) => {
    const { instructorId, rate } = req.body;
    const setting = await financeService.updateInstructorCommission(instructorId, rate);

    res.status(200).json({
        status: 'success',
        message: `Đã cập nhật tỉ lệ ăn chia riêng cho giảng viên ID: ${instructorId}`,
        data: { setting }
    });
});

// ... (các hàm cũ)

// ==========================================
// NHÓM API ADMIN
// ==========================================

exports.getAllWithdrawalRequests = catchAsync(async (req, res, next) => {
    // Truyền req.query xuống để hỗ trợ lọc (vd: /admin/withdrawals?status=Pending)
    const requests = await financeService.getAllWithdrawalRequests(req.query);

    res.status(200).json({
        status: 'success',
        results: requests.length,
        data: { requests }
    });
});

exports.reviewWithdrawalRequest = catchAsync(async (req, res, next) => {
    const { status, adminNote } = req.body;

    const request = await financeService.reviewWithdrawalRequest(req.params.id, status, adminNote);

    res.status(200).json({
        status: 'success',
        message: `Đã cập nhật trạng thái lệnh rút tiền thành: ${status}`,
        data: { request }
    });
});