const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');

const Enrollment = sequelize.define('Enrollment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    courseId: { type: DataTypes.INTEGER, allowNull: false },
    progressPercent: { type: DataTypes.INTEGER, defaultValue: 0 } // Tiến độ học tập %
}, {
    tableName: 'enrollments',
    timestamps: true
});

module.exports = Enrollment;