const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');
const User = require('../users/user.model');

const Notification = sequelize.define('Notification', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false }, // Người nhận

    title: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },

    // Phân loại để frontend hiển thị icon cho đẹp
    type: {
        type: DataTypes.ENUM('System', 'Course', 'Finance', 'QnA', 'Account'),
        defaultValue: 'System'
    },

    // Link điều hướng khi user click vào thông báo (VD: /courses/1/learn)
    actionUrl: { type: DataTypes.STRING, allowNull: true },

    isRead: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: 'notifications',
    timestamps: true
});

// Quan hệ: 1 User có nhiều Notification
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId' });

module.exports = Notification;