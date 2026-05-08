const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');

const WithdrawalRequest = sequelize.define('WithdrawalRequest', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    instructorId: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.INTEGER, allowNull: false },
    status: {
        type: DataTypes.ENUM('Pending', 'Approved', 'Completed', 'Rejected'),
        defaultValue: 'Pending'
    },
    adminNote: { type: DataTypes.TEXT, allowNull: true }, // Lý do từ chối nếu có
    bankInfoSnapshot: { type: DataTypes.TEXT, allowNull: false } // Lưu lại STK lúc rút, phòng khi GV đổi STK
}, {
    tableName: 'withdrawal_requests',
    timestamps: true
});

module.exports = WithdrawalRequest;