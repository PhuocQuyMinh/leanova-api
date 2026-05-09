const Notification = require('./notification.model');
const User = require('../users/user.model');
const sendEmail = require('../../core/utils/email.util');

// ==========================================
// 1. HÀM DÙNG CHUNG CHO CÁC MODULE KHÁC GỌI
// ==========================================
exports.pushNotification = async ({ userId, title, message, type, actionUrl, isSendEmail = false }) => {
    // 1. Lưu thông báo vào Database (In-app)
    const notification = await Notification.create({
        userId,
        title,
        message,
        type,
        actionUrl
    });

    // 2. Gửi Email nếu được yêu cầu
    if (isSendEmail) {
        const user = await User.findByPk(userId, { attributes: ['email', 'fullName'] });
        if (user && user.email) {
            try {
                await sendEmail({
                    email: user.email,
                    subject: title,
                    // Template HTML cơ bản, bạn có thể làm đẹp hơn sau
                    html: `
                        <h3>Xin chào ${user.fullName},</h3>
                        <p>${message}</p>
                        ${actionUrl ? `<a href="${process.env.FRONTEND_URL}${actionUrl}">Nhấn vào đây để xem chi tiết</a>` : ''}
                        <br><p>Trân trọng,<br>Đội ngũ Leanova</p>
                    `
                });
            } catch (error) {
                console.error('Lỗi gửi email:', error);
                // Không throw error ở đây để tránh làm đứt mạch code chính (VD: tiền đã duyệt xong nhưng lỗi gửi mail thì vẫn phải thành công giao dịch)
            }
        }
    }

    return notification;
};

// ==========================================
// 2. CÁC HÀM PHỤC VỤ API CỦA FRONTEND
// ==========================================
exports.getUserNotifications = async (userId) => {
    return await Notification.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']], // Mới nhất lên đầu
        limit: 50 // Chỉ lấy 50 cái gần nhất cho nhẹ DB
    });
};

exports.markAsRead = async (notificationId, userId) => {
    return await Notification.update(
        { isRead: true },
        { where: { id: notificationId, userId } }
    );
};

exports.markAllAsRead = async (userId) => {
    return await Notification.update(
        { isRead: true },
        { where: { userId, isRead: false } }
    );
};