const dashboardService = require('./dashboard.service');
const catchAsync = require('../../core/utils/catchAsync');

exports.getAdminDashboard = catchAsync(async (req, res, next) => {
    const data = await dashboardService.getAdminOverview();
    res.status(200).json({ status: 'success', data });
});