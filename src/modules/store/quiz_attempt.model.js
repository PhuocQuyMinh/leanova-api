const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');

const QuizAttempt = sequelize.define('QuizAttempt', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    quizId: { type: DataTypes.INTEGER, allowNull: false },
    scorePercent: { type: DataTypes.FLOAT, allowNull: false }, // Điểm đạt được (%)
    isPassed: { type: DataTypes.BOOLEAN, allowNull: false }    // Qua môn hay rớt
}, {
    tableName: 'quiz_attempts',
    timestamps: true
});

module.exports = QuizAttempt;