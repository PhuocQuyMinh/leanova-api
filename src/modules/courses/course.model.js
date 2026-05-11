const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');
const User = require('../users/user.model');

const Course = sequelize.define('Course', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Tên khóa học không được để trống' }
        }
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    price: {
        type: DataTypes.INTEGER,
        defaultValue: 0 // Free
    },
    status: {
        type: DataTypes.ENUM('Pending', 'Published', 'Rejected'),
        defaultValue: 'Pending' // Vừa tạo xong sẽ ở trạng thái chờ Admin/Mod duyệt
    },
    rejectMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Lý do kiểm duyệt viên từ chối khóa học này'
    },
    coverImage: {
        type: DataTypes.STRING,
        allowNull: true // Ảnh bìa có thể cập nhật sau
    },
    averageRating: {
        type: DataTypes.FLOAT,
        defaultValue: 0.0
    },
    reviewCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    // 1. Mô tả chi tiết nội dung khóa học (Những gì học viên sẽ học được)
    courseContent: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        comment: 'Nội dung chi tiết của khóa học (Hỗ trợ HTML/Rich Text)'
    },

    // 2. Đối tượng hướng đến
    targetAudience: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Khóa học này dành cho ai? (Hỗ trợ HTML/Rich Text)'
    },

    // 3. Yêu cầu đầu vào (Prerequisites)
    prerequisites: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Yêu cầu kiến thức/thiết bị trước khi tham gia khóa học'
    },
}, {
    tableName: 'courses',
    timestamps: true
});

const Section = require('./section.model');
const Lesson = require('./lesson.model');
const Attachment = require('./attachment.model');
const Quiz = require('./quiz.model');
const CartItem = require('../store/cart_item.model');
const Enrollment = require('../store/enrollment.model');
const Review = require('./review.model');
const Category = require('../categories/category.model.js');

// THIẾT LẬP QUAN HỆ (1 Giảng viên có nhiều Khóa học)
// Cột instructorId sẽ tự động được thêm vào bảng courses
User.hasMany(Course, { foreignKey: 'instructorId', as: 'courses' });
Course.belongsTo(User, { foreignKey: 'instructorId', as: 'instructor' });

// 2. Course - Section
Course.hasMany(Section, { foreignKey: 'courseId', as: 'sections', onDelete: 'CASCADE' });
Section.belongsTo(Course, { foreignKey: 'courseId' });


// 3. Section - Lesson
Section.hasMany(Lesson, { foreignKey: 'sectionId', as: 'lessons', onDelete: 'CASCADE' });
Lesson.belongsTo(Section, { foreignKey: 'sectionId' });

// 4. Section - Quiz (Một chương có thể có nhiều bài Test kiểm tra)
Lesson.hasMany(Quiz, { foreignKey: 'lessonId', as: 'quizzes', onDelete: 'CASCADE' });
Quiz.belongsTo(Lesson, { foreignKey: 'lessonId' });

// 5. Lesson - Attachment (1 Bài học có thể đính kèm nhiều File)
Lesson.hasMany(Attachment, { foreignKey: 'lessonId', as: 'attachments', onDelete: 'CASCADE' });
Attachment.belongsTo(Lesson, { foreignKey: 'lessonId' });

Course.hasMany(CartItem, { foreignKey: 'courseId' });
CartItem.belongsTo(Course, { foreignKey: 'courseId' });

Course.hasMany(Enrollment, { foreignKey: 'courseId' });
Enrollment.belongsTo(Course, { foreignKey: 'courseId' });

Course.hasMany(Review, { foreignKey: 'courseId', as: 'reviews' });
Review.belongsTo(Course, { foreignKey: 'courseId' });

Category.hasMany(Course, { foreignKey: 'categoryId', as: 'courses' });
Course.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

module.exports = Course;