const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');

const InstructorRequest = sequelize.define('InstructorRequest', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },

    // Kinh nghiệm giảng dạy / Link Profile (LinkedIn, Portfolio)
    bio: { type: DataTypes.TEXT, allowNull: false },
    experience: { type: DataTypes.STRING, allowNull: true },
    // [MỚI] Link LinkedIn hoặc Portfolio (Dạng Text)
    portfolioUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },

    // [MỚI] Đường dẫn lưu file chứng chỉ / CV / Bằng cấp
    certificateUrl: {
        type: DataTypes.STRING,
        allowNull: false // Bắt buộc phải có bằng chứng
    },
    status: {
        type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
        defaultValue: 'Pending'
    },
    isTermsAccepted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false // Mặc định là chưa đồng ý
    },
    // Lý do từ chối (Nếu Mod reject thì phải điền cột này)
    rejectReason: { type: DataTypes.TEXT, allowNull: true }
}, {
    tableName: 'instructor_requests',
    timestamps: true
});

module.exports = InstructorRequest;