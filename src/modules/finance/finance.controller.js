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