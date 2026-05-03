const jwt = require('jsonwebtoken');
const User = require('../users/user.model');
const AppError = require('../../core/utils/appError');

// Hàm tạo mã Token (Giấy thông hành)
const signToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
};

// Logic Đăng ký
exports.register = async (userData) => {
    // 1. Kiểm tra xem email đã tồn tại chưa
    const existingUser = await User.findOne({ where: { email: userData.email } });
    if (existingUser) {
        throw new AppError('Email này đã được sử dụng. Vui lòng chọn email khác!', 400);
    }

    // 2. Tạo User mới (Mật khẩu sẽ tự động bị băm nhờ cái Hook ta viết bên Model)
    const newUser = await User.create({
        fullName: userData.fullName,
        email: userData.email,
        password: userData.password,
        role: userData.role || 'Student' // Mặc định ai đăng ký cũng là Học viên
    });

    // 3. Xóa biến password đi để không vô tình trả về cho phía Client (Bảo mật)
    newUser.password = undefined;

    // 4. Cấp giấy thông hành JWT
    const token = signToken(newUser.id, newUser.role);

    return { user: newUser, token };
};

// Logic Đăng nhập
exports.login = async (email, password) => {
    // 1. Kiểm tra user có truyền đủ email và pass không
    if (!email || !password) {
        throw new AppError('Vui lòng cung cấp email và mật khẩu!', 400);
    }

    // 2. Tìm User trong CSDL
    const user = await User.findOne({ where: { email } });

    // 3. Nếu User không tồn tại HOẶC mật khẩu giải mã ra không khớp -> Báo lỗi
    if (!user || !(await user.correctPassword(password, user.password))) {
        throw new AppError('Email hoặc mật khẩu không chính xác!', 401);
    }

    // 4. Nếu đúng hết, cấp giấy thông hành
    const token = signToken(user.id, user.role);

    return {
        user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
        token
    };
};