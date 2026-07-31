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
    const verifyUrl = `http://localhost:3000/verify-email?token=${verifyToken}`;

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

    // [ĐÃ SỬA] Chỉ bóc tách và trả về các thông tin an toàn (Safe Payload)
    const safeUser = {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl
    };

    return { user: safeUser, token };
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

// ... các require đã có (crypto, sendEmail, User...)

// ==========================================
// 5. YÊU CẦU QUÊN MẬT KHẨU (GỬI MAIL)
// ==========================================
exports.forgotPassword = async (email) => {
    // 1. Tìm user dựa vào email
    const user = await User.findOne({ where: { email } });
    if (!user) {
        throw new AppError('Không tìm thấy tài khoản nào với địa chỉ email này!', 404);
    }

    // (Tùy chọn) Nếu user này đăng nhập bằng Google thì không cho đổi pass ở đây
    if (user.authProvider === 'Google') {
        throw new AppError('Tài khoản này được đăng nhập bằng Google. Vui lòng đổi mật khẩu trên hệ thống của Google!', 400);
    }

    // 2. Tạo Token ngẫu nhiên
    const resetToken = crypto.randomBytes(32).toString('hex');

    // 3. Băm Token để lưu vào DB (Bảo mật)
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000; // Token chỉ sống được 15 phút

    await user.save({ validate: false });

    // 4. Gửi email
    // const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const resetUrl = `http://localhost:3000/reset-password?token=${resetToken}`;

    // DEBUG: In link ra terminal để test dễ hơn
    console.log('\n--- LINK ĐẶT LẠI MẬT KHẨU CỦA BẠN ĐÂY ---');
    console.log(resetUrl);
    console.log('-----------------------------------------\n');

    const message = `
        <h2>Yêu cầu đặt lại mật khẩu</h2>
        <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản Leanova. Vui lòng nhấn vào nút bên dưới để tạo mật khẩu mới:</p>
        <a href="${resetUrl}" style="padding: 10px 20px; background-color: #f44336; color: white; text-decoration: none; border-radius: 5px;">Đặt lại mật khẩu</a>
        <p><i>Lưu ý: Link này sẽ hết hạn sau 15 phút. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</i></p>
    `;

    try {
        await sendEmail({
            email: user.email,
            subject: 'Đặt lại mật khẩu tài khoản Leanova của bạn (Hợp lệ trong 15 phút)',
            html: message
        });

        return { message: 'Đường dẫn đặt lại mật khẩu đã được gửi vào email của bạn!' };
    } catch (err) {
        // Nếu gửi mail lỗi, phải xóa Token trong DB đi để họ có thể gửi lại
        user.passwordResetToken = null;
        user.passwordResetExpires = null;
        await user.save({ validate: false });

        throw new AppError('Có lỗi xảy ra khi gửi email. Vui lòng thử lại sau!', 500);
    }
};

// ==========================================
// 6. ĐẶT LẠI MẬT KHẨU MỚI
// ==========================================
exports.resetPassword = async (token, newPassword) => {
    // 1. Băm cái token do user gửi lên để tìm trong DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // 2. Tìm user dựa vào token VÀ thời gian hết hạn phải lớn hơn hiện tại
    const user = await User.findOne({
        where: {
            passwordResetToken: hashedToken,
            passwordResetExpires: { [require('sequelize').Op.gt]: new Date() }
        }
    });

    // 3. Nếu không tìm thấy hoặc token hết hạn
    if (!user) {
        throw new AppError('Token không hợp lệ hoặc đã hết hạn!', 400);
    }

    // 4. Cập nhật mật khẩu mới (Model User sẽ tự động băm password này nhờ hook beforeSave)
    user.password = newPassword;

    // Xóa token đi để không bị dùng lại
    user.passwordResetToken = null;
    user.passwordResetExpires = null;

    await user.save();

    // 5. Cấp lại luôn một JWT Token mới để họ tự động đăng nhập sau khi đổi pass xong
    const jwtToken = signToken(user.id, user.role);

    return {
        message: 'Mật khẩu của bạn đã được thay đổi thành công!',
        user,
        token: jwtToken
    };
};