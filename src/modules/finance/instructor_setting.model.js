const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');

const InstructorSetting = sequelize.define('InstructorSetting', {
    userId: { type: DataTypes.INTEGER, primaryKey: true }, // ID của giảng viên
    commissionRate: { type: DataTypes.FLOAT, defaultValue: 0.7 }, // Mặc định ăn chia 70-30 (Giảng viên 70%)
    bankName: { type: DataTypes.STRING, allowNull: true },
    bankAccount: { type: DataTypes.STRING, allowNull: true },
    accountName: { type: DataTypes.STRING, allowNull: true }
}, {
    tableName: 'instructor_settings',
    timestamps: false
});

module.exports = InstructorSetting;