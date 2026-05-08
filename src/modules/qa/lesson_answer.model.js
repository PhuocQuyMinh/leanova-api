const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');
const User = require('../users/user.model');
const LessonQuestion = require('./lesson_question.model');

const LessonAnswer = sequelize.define('LessonAnswer', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    questionId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    isInstructorResponse: { type: DataTypes.BOOLEAN, defaultValue: false } // Đánh dấu đây là câu trả lời của giảng viên
}, {
    tableName: 'lesson_answers',
    timestamps: true
});

// Liên kết
LessonQuestion.hasMany(LessonAnswer, { foreignKey: 'questionId', as: 'answers' });
LessonAnswer.belongsTo(LessonQuestion, { foreignKey: 'questionId' });

User.hasMany(LessonAnswer, { foreignKey: 'userId', as: 'answers' });
LessonAnswer.belongsTo(User, { foreignKey: 'userId', as: 'author' });

module.exports = LessonAnswer;