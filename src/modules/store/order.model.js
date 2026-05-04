const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');

const Order = sequelize.define('Order', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.INTEGER, allowNull: false }, // Tổng tiền giỏ hàng
    status: {
        type: DataTypes.ENUM('Pending', 'Success', 'Failed'),
        defaultValue: 'Pending'
    },
    txnRef: { type: DataTypes.STRING, allowNull: false } // Mã giao dịch độc nhất (Mã đơn hàng)
}, {
    tableName: 'orders',
    timestamps: true
});

module.exports = Order;