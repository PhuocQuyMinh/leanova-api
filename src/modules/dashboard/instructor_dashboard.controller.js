const dashboardService = require('./instructor_dashboard.service');
const catchAsync = require('../../core/utils/catchAsync');

exports.getGlobalStats = catchAsync(async (req, res, next) => {
    const stats = await dashboardService.getGlobalStats(req.user.id);

    res.status(200).json({
        status: 'success',
        data: stats
    });
});

exports.getCourseSpecificStats = catchAsync(async (req, res, next) => {
    const stats = await dashboardService.getCourseSpecificStats(req.user.id, req.params.courseId);

    res.status(200).json({
        status: 'success',
        data: stats
    });
});