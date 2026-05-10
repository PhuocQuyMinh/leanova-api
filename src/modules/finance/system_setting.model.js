const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');

const SystemSetting = sequelize.define('SystemSetting', {
    key: {
        type: DataTypes.STRING,
        primaryKey: true // VD: 'DEFAULT_COMMISSION_RATE'
    },
    value: {
        type: DataTypes.TEXT('long'),
        allowNull: false
    },
    description: { type: DataTypes.TEXT, allowNull: true }
}, {
    tableName: 'system_settings',
    timestamps: true
});

module.exports = SystemSetting;