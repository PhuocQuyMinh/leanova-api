const { Sequelize } = require('sequelize');

// Khởi tạo kết nối từ các biến môi trường trong file .env
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        logging: false, // Tắt dòng log câu lệnh SQL trên terminal cho đỡ rối
        pool: {
            max: 5,     // Số kết nối tối đa
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

// Hàm kiểm tra kết nối
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('📦 Kết nối Database MySQL thành công!');
    } catch (error) {
        console.error('❌ Lỗi kết nối Database:', error);
    }
};

testConnection();

module.exports = sequelize;