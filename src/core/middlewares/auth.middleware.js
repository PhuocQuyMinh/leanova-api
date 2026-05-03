const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../../modules/users/user.model');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

// ==========================================
// LỚP 1: KIỂM TRA ĐĂNG NHẬP (CÓ TOKEN KHÔNG?)
// ==========================================
exports.protect = catchAsync(async (req, res, next) => {
    // 1. Lấy token từ Header (Client thường gửi token trong header 'Authorization: Bearer <token>')
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    // Nếu không có token -> Đuổi về
    if (!token) {
        return next(new AppError('Bạn chưa đăng nhập! Vui lòng đăng nhập để truy cập.', 401));
    }

    // 2. Xác thực Token (Có bị làm giả không? Đã hết hạn chưa?)
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3. Kiểm tra xem User mang token này có còn tồn tại trong DB không? (Lỡ bị Admin xóa rồi)
    const currentUser = await User.findByPk(decoded.id);
    if (!currentUser) {
        return next(new AppError('Người dùng sở hữu token này không còn tồn tại.', 401));
    }

    // 4. Mọi thứ OK! Cấp quyền đi tiếp.
    // Lưu thông tin User vào req để các route đằng sau có thể lấy ra dùng (ví dụ: req.user.id)
    req.user = currentUser;
    next();
});

// ==========================================
// LỚP 2: KIỂM TRA VAI TRÒ (CÓ ĐÚNG CHỨC DANH KHÔNG?)
// ==========================================
// Middleware này nhận vào một mảng các Role được phép truy cập (Ví dụ: ['Admin', 'Mod'])
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        // Kiểm tra xem Role của user hiện tại có nằm trong danh sách cho phép không
        if (!roles.includes(req.user.role)) {
            return next(new AppError('Bạn không có quyền thực hiện hành động này!', 403));
        }

        // Có quyền -> Đi tiếp
        next();
    };
};