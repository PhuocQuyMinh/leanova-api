const jwt = require('jsonwebtoken');
const User = require('../users/user.model');
const AppError = require('../../core/utils/appError');

const crypto = require('crypto'); // Built-in module của Node.js
const { OAuth2Client } = require('google-auth-library'); // Cần chạy: npm i google-auth-library
const sendEmail = require('../../core/utils/email.util');

// Hàm tạo mã Token (Giấy thông hành)
const signToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
};

// ==========================================
// 1. ĐĂNG KÝ BẰNG EMAIL (Có xác thực)
// ==========================================
exports.register = async (userData) => {
    const existingUser = await User.findOne({ where: { email: userData.email } });
    if (existingUser) throw new AppError('Email này đã được sử dụng!', 400);

    // 1. Tạo User (Lúc này isEmailVerified = false)
    const newUser = await User.create({
        fullName: userData.fullName,
        email: userData.email,
        password: userData.password,
        role: userData.role || 'Student',
        authProvider: 'Local'
    });

    // 2. Tạo mã Token xác thực ngẫu nhiên (32 ký tự hex)
    const verifyToken = crypto.randomBytes(32).toString('hex');

    // 3. Băm mã này lại để lưu vào DB (Bảo mật chống hacker chôm DB)
    newUser.emailVerificationToken = crypto.createHash('sha256').update(verifyToken).digest('hex');
    newUser.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // Hết hạn sau 24h
    await newUser.save({ validate: false });

    // 4. Gửi Email chào mừng kèm Link xác thực
    // const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verifyToken}`;
    const verifyUrl = `test/verify-email?token=${verifyToken}`;

    try {
        await sendEmail({
            email: newUser.email,
            subject: 'Chào mừng bạn đến với Leanova - Vui lòng xác thực tài khoản',
            html: `
                <h2>Xin chào ${newUser.fullName}, chào mừng bạn đến với Leanova!</h2>
                <p>Cảm ơn bạn đã đăng ký tài khoản. Để bắt đầu hành trình học tập, vui lòng nhấn vào nút bên dưới để xác minh địa chỉ email của bạn:</p>
                <a href="${verifyUrl}" style="padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Xác thực Email ngay</a>
                <p><i>Lưu ý: Link này sẽ hết hạn sau 24 giờ.</i></p>
            `
        });
    } catch (error) {
        console.error('Lỗi gửi mail xác thực:', error);
        // Không chặn luồng, nhưng có thể log lỗi
    }

    // Không trả về JWT Token ngay, bắt user phải vào mail click link
    return {
        message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác minh tài khoản trước khi đăng nhập.'
    };
};

// ==========================================
// 2. XỬ LÝ KHI USER CLICK VÀO LINK TRONG MAIL
// ==========================================
exports.verifyEmail = async (token) => {
    // 1. Băm cái token người dùng gửi lên để so sánh với DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
        where: {
            emailVerificationToken: hashedToken,
            // Đảm bảo token chưa hết hạn (Hàm Op.gt của Sequelize: Lớn hơn thời gian hiện tại)
            emailVerificationExpires: { [require('sequelize').Op.gt]: new Date() }
        }
    });

    if (!user) throw new AppError('Token không hợp lệ hoặc đã hết hạn!', 400);

    // 2. Kích hoạt tài khoản
    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save({ validate: false });

    return { message: 'Xác thực email thành công! Bây giờ bạn có thể đăng nhập.' };
};

// ==========================================
// 3. ĐĂNG NHẬP TRUYỀN THỐNG (Local)
// ==========================================
exports.login = async (email, password) => {
    if (!email || !password) throw new AppError('Vui lòng cung cấp email và mật khẩu!', 400);

    const user = await User.findOne({ where: { email } });

    if (!user || !(await user.correctPassword(password, user.password))) {
        throw new AppError('Email hoặc mật khẩu không chính xác!', 401);
    }

    // [MỚI] Chặn nếu chưa xác thực email
    if (user.authProvider === 'Local' && !user.isEmailVerified) {
        throw new AppError('Vui lòng kiểm tra hộp thư và xác thực email trước khi đăng nhập!', 403);
    }

    const token = signToken(user.id, user.role);
    return { user, token };
};

// Khởi tạo Client của Google
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ==========================================
// 4. ĐĂNG NHẬP / ĐĂNG KÝ BẰNG GOOGLE
// ==========================================
exports.loginWithGoogle = async (idToken) => {
    // 1. Xác minh Token do Frontend gửi lên có thực sự là của Google cấp không
    const ticket = await googleClient.verifyIdToken({
        idToken: idToken,
        audience: process.env.GOOGLE_CLIENT_ID
    });

    // Lấy thông tin user từ Google
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    // 2. Tìm xem User này đã có trong DB chưa
    let user = await User.findOne({ where: { email } });

    if (!user) {
        // NẾU CHƯA CÓ: Tự động tạo tài khoản mới cho họ
        user = await User.create({
            fullName: name,
            email: email,
            password: crypto.randomBytes(16).toString('hex'), // Tạo pass ngẫu nhiên vì họ dùng Google
            role: 'Student',
            authProvider: 'Google',
            avatarUrl: picture,
            isEmailVerified: true // Mặc định true vì Google đã xác thực email này rồi
        });
    } else {
        // NẾU ĐÃ CÓ (Có thể họ đăng ký bằng Local trước đó):
        // Update lại ảnh đại diện hoặc đánh dấu là đã verified luôn
        if (!user.isEmailVerified) {
            user.isEmailVerified = true;
            await user.save({ validate: false });
        }
    }

    // 3. Cấp JWT Token của Leanova
    const token = signToken(user.id, user.role);

    return {
        user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, avatarUrl: user.avatarUrl },
        token
    };
};