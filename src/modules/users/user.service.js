const User = require('./user.model');
const AppError = require('../../core/utils/appError');

// 1. Khóa tài khoản
exports.lockAccount = async (targetUserId, lockReason) => {
    const user = await User.findByPk(targetUserId);
    if (!user) throw new AppError('Không tìm thấy người dùng này!', 404);

    // Luật bất thành văn: Không ai được phép khóa Admin
    if (user.role === 'Admin') {
        throw new AppError('Lỗi bảo mật: Không thể khóa tài khoản Quản trị viên!', 403);
    }

    if (!lockReason || lockReason.trim() === '') {
        throw new AppError('Vui lòng cung cấp lý do khóa để thông báo cho người dùng!', 400);
    }

    user.isActive = false;
    user.lockReason = lockReason;
    await user.save();

    return user;
};

// 2. Mở khóa tài khoản (Khoan hồng)
exports.unlockAccount = async (targetUserId) => {
    const user = await User.findByPk(targetUserId);
    if (!user) throw new AppError('Không tìm thấy người dùng này!', 404);

    user.isActive = true;
    user.lockReason = null; // Xóa án tích
    await user.save();

    return user;
};