const notifService = require('./notification.service');
const catchAsync = require('../../core/utils/catchAsync');

exports.getMyNotifications = catchAsync(async (req, res, next) => {
    const notifications = await notifService.getUserNotifications(req.user.id);

    // Đếm số lượng chưa đọc để hiện Badge màu đỏ trên quả chuông
    const unreadCount = notifications.filter(n => !n.isRead).length;

    res.status(200).json({ status: 'success', unreadCount, data: { notifications } });
});

exports.markAsRead = catchAsync(async (req, res, next) => {
    await notifService.markAsRead(req.params.id, req.user.id);
    res.status(200).json({ status: 'success', message: 'Đã đánh dấu đọc.' });
});

exports.markAllAsRead = catchAsync(async (req, res, next) => {
    await notifService.markAllAsRead(req.user.id);
    res.status(200).json({ status: 'success', message: 'Đã đánh dấu đọc tất cả.' });
});