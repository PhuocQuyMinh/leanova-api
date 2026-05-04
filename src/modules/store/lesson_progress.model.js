const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');

const LessonProgress = sequelize.define('LessonProgress', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    lessonId: { type: DataTypes.INTEGER, allowNull: false },
    isCompleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: 'lesson_progresses',
    timestamps: true
});

module.exports = LessonProgress;