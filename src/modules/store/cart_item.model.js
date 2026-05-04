const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');

const CartItem = sequelize.define('CartItem', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    courseId: { type: DataTypes.INTEGER, allowNull: false }
}, {
    tableName: 'cart_items',
    timestamps: true
});

module.exports = CartItem;