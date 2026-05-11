const catchAsync = require('../../core/utils/catchAsync');
const userService = require('./user.service');

exports.getMe = catchAsync(async (req, res, next) => {
    // Nhờ middleware protect, biến req.user đã chứa đầy đủ thông tin của người dùng!
    res.status(200).json({
        status: 'success',
        data: {
            user: {
                id: req.user.id,
                fullName: req.user.fullName,
                email: req.user.email,
                avartar: req.user.avatarUrl,
                role: req.user.role
            }
        }
    });
});

// API test phân quyền: Chỉ Admin mới gọi được
exports.getAdminDashboard = catchAsync(async (req, res, next) => {
    res.status(200).json({
        status: 'success',
        message: 'Chào mừng sếp Admin quay trở lại!'
    });
});

exports.lockAccount = catchAsync(async (req, res, next) => {
    const { lockReason } = req.body;
    await userService.lockAccount(req.params.userId, lockReason);

    res.status(200).json({
        status: 'success',
        message: 'Đã khóa tài khoản thành công! Người dùng này sẽ bị đăng xuất ngay lập tức.'
    });
});

exports.unlockAccount = catchAsync(async (req, res, next) => {
    await userService.unlockAccount(req.params.userId);

    res.status(200).json({
        status: 'success',
        message: 'Đã mở khóa tài khoản thành công!'
    });
});