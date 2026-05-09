const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // 1. Cấu hình Transporter (Dùng Gmail hoặc SMTP của bạn)
    const transporter = nodemailer.createTransport({
        service: 'Gmail', // Hoặc host: 'smtp.mailtrap.io' để test
        auth: {
            user: process.env.EMAIL_USERNAME, // Cấu hình trong file .env
            pass: process.env.EMAIL_PASSWORD  // App Password của Gmail
        }
    });

    // 2. Tùy chọn Email
    const mailOptions = {
        from: 'Leanova Education <noreply@leanova.com>',
        to: options.email,
        subject: options.subject,
        html: options.html // Hỗ trợ gửi template HTML cho đẹp
    };

    // 3. Gửi
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;