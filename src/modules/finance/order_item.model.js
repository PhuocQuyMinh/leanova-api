const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');
const Order = require('../store/order.model');
const Course = require('../courses/course.model');

const OrderItem = sequelize.define('OrderItem', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    orderId: { type: DataTypes.INTEGER, allowNull: false },
    courseId: { type: DataTypes.INTEGER, allowNull: false },
    instructorId: { type: DataTypes.INTEGER, allowNull: false }, // ID Giảng viên
    priceAtPurchase: { type: DataTypes.INTEGER, allowNull: false }, // Giá lúc mua
    commissionRate: { type: DataTypes.FLOAT, allowNull: false }, // % Giảng viên nhận (VD: 0.8 = 80%)
    instructorEarnings: { type: DataTypes.INTEGER, allowNull: false } // Số tiền thực nhận = price * commission
}, {
    tableName: 'order_items',
    timestamps: true
});

Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

module.exports = OrderItem;