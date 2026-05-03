const authService = require('./auth.service');
const catchAsync = require('../../core/utils/catchAsync');

exports.register = catchAsync(async (req, res, next) => {
    // Chuyển dữ liệu người dùng gửi lên (req.body) cho Service xử lý
    const result = await authService.register(req.body);

    // Trả response cho client 201 = Created
    res.status(201).json({
        status: 'success',
        message: 'Đăng ký tài khoản thành công!',
        token: result.token,
        data: result.user
    });
});

exports.login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    // Trả response cho client
    res.status(200).json({
        status: 'success',
        message: 'Đăng nhập thành công!',
        token: result.token,
        data: result.user
    });
});