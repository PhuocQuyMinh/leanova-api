const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');
const User = require('../users/user.model');
const Lesson = require('../courses/lesson.model');

const LessonQuestion = sequelize.define('LessonQuestion', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    lessonId: { type: DataTypes.INTEGER, allowNull: false },
    courseId: { type: DataTypes.INTEGER, allowNull: false }, // Lưu dư thừa courseId để Giảng viên dễ lọc toàn bộ câu hỏi của khóa học
    userId: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false }, // Tiêu đề câu hỏi
    content: { type: DataTypes.TEXT, allowNull: false }, // Nội dung chi tiết
    isResolved: { type: DataTypes.BOOLEAN, defaultValue: false } // Đánh dấu đã giải quyết xong chưa
}, {
    tableName: 'lesson_questions',
    timestamps: true
});

// Liên kết
Lesson.hasMany(LessonQuestion, { foreignKey: 'lessonId', as: 'questions' });
LessonQuestion.belongsTo(Lesson, { foreignKey: 'lessonId', as: 'lesson' });

User.hasMany(LessonQuestion, { foreignKey: 'userId', as: 'questions' });
LessonQuestion.belongsTo(User, { foreignKey: 'userId', as: 'author' });

module.exports = LessonQuestion;