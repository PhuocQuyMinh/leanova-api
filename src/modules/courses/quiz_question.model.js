const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');

const QuizQuestion = sequelize.define('QuizQuestion', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    quizId: { type: DataTypes.INTEGER, allowNull: false },
    questionText: { type: DataTypes.TEXT, allowNull: false },

    // Sử dụng JSON để lưu mảng các đáp án (Kỹ thuật nâng cao trong MySQL)
    // Ví dụ: [{"id": 1, "text": "A", "isCorrect": true}, {"id": 2, "text": "B", "isCorrect": false}]
    choices: { type: DataTypes.JSON, allowNull: false },

    explanation: { type: DataTypes.TEXT, allowNull: true } // Giải thích sau khi làm sai
}, {
    tableName: 'quiz_questions',
    timestamps: true
});

module.exports = QuizQuestion;