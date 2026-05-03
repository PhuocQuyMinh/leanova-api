const catchAsync = require('../../core/utils/catchAsync');

exports.getMe = catchAsync(async (req, res, next) => {
    // Nhờ middleware protect, biến req.user đã chứa đầy đủ thông tin của người dùng!
    res.status(200).json({
        status: 'success',
        data: {
            user: {
                id: req.user.id,
                fullName: req.user.fullName,
                email: req.user.email,
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