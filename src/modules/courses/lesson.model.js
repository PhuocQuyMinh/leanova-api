const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');
const LessonProgress = require('../store/lesson_progress.model');

const Lesson = sequelize.define('Lesson', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },

    // Loại bài học chính: Video giảng bài hoặc Bài đọc Text
    lessonType: {
        type: DataTypes.ENUM('Video', 'Article'),
        defaultValue: 'Video'
    },

    // Nếu là Video thì lưu URL (Youtube/Cloudinary)
    videoUrl: { type: DataTypes.STRING, allowNull: true },
    // Cột lưu thời lượng video (ví dụ: 15:30) để hiển thị trên UI
    durationString: { type: DataTypes.STRING, allowNull: true },

    // Nếu là Article thì lưu nội dung dạng HTML/Rich Text
    articleContent: { type: DataTypes.TEXT('long'), allowNull: true },

    // Có cho phép xem thử (Preview) trước khi mua không?
    isPreviewable: { type: DataTypes.BOOLEAN, defaultValue: false },

    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
    tableName: 'lessons',
    timestamps: true
});

Lesson.hasMany(LessonProgress, { foreignKey: 'lessonId', as: 'progress' });
LessonProgress.belongsTo(Lesson, { foreignKey: 'lessonId' });

module.exports = Lesson;