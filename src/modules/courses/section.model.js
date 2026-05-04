const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');

const Section = sequelize.define('Section', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 } // Thứ tự sắp xếp của chương
}, {
    tableName: 'sections',
    timestamps: true
});

module.exports = Section;