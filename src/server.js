require('dotenv').config(); // Load biến môi trường

const sequelize = require('./core/database/init.mysql'); // <-- Gọi file kết nối
const User = require('./modules/users/user.model');      // <-- Gọi Model User để nó biết mà tạo bảng

const app = require('./app');

const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, async () => {
    console.log(`🚀 Server Leanova đang chạy tại port ${PORT}...`);

    try {
        // Lệnh sync({ alter: true }) giúp tự cập nhật cột nếu bạn sửa code model
        await sequelize.sync({ alter: true });
        console.log('🔄 Đã đồng bộ cấu trúc Database thành công!');
    } catch (error) {
        console.log('❌ Lỗi đồng bộ Database:', error);
    }
});

// Bắt các lỗi văng ra ngoài tầm kiểm soát (Ví dụ: Lỗi sập DB)
process.on('unhandledRejection', err => {
    console.log('UNHANDLED REJECTION! 💥 Server đang đóng...');
    console.log(err.name, err.message);
    server.close(() => {
        process.exit(1);
    });
});