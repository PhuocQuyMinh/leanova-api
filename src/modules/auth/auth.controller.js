const authService = require('./auth.service');
const catchAsync = require('../../core/utils/catchAsync');

// Đăng ký tài khoản mới (Gửi mail xác thực)
exports.register = catchAsync(async (req, res, next) => {
    const result = await authService.register(req.body);

    res.status(201).json({
        status: 'success',
        message: result.message
    });
});

// Xác thực Email từ đường dẫn trong Mail
exports.verifyEmail = catchAsync(async (req, res, next) => {
    const result = await authService.verifyEmail(req.query.token);

    res.status(200).json({
        status: 'success',
        message: result.message
    });
});

// Đăng nhập truyền thống
exports.login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;
    const { user, token } = await authService.login(email, password);

    res.status(200).json({
        status: 'success',
        token,
        data: { user }
    });
});

// Đăng nhập bằng Google
exports.googleLogin = catchAsync(async (req, res, next) => {
    const { idToken } = req.body;
    const { user, token } = await authService.loginWithGoogle(idToken);

    res.status(200).json({
        status: 'success',
        token,
        data: { user }
    });
});