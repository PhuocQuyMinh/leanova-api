const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');
const QuizQuestion = require('./quiz_question.model');

const Quiz = sequelize.define('Quiz', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },

    // Điểm cần đạt để pass (VD: 80%)
    passingScorePercent: { type: DataTypes.INTEGER, defaultValue: 80 },

    // Thời gian làm bài (Phút)
    timeLimitMinutes: { type: DataTypes.INTEGER, allowNull: true },

    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
    tableName: 'quizzes',
    timestamps: true
});

Quiz.hasMany(QuizQuestion, { foreignKey: 'quizId', as: 'questions' });
QuizQuestion.belongsTo(Quiz, { foreignKey: 'quizId' });

module.exports = Quiz;