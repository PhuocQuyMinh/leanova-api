const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');
const User = require('../users/user.model'); // Import model User để nối bảng

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
    }
}, {
    tableName: 'courses',
    timestamps: true
});

// THIẾT LẬP QUAN HỆ (1 Giảng viên có nhiều Khóa học)
// Cột instructorId sẽ tự động được thêm vào bảng courses
User.hasMany(Course, { foreignKey: 'instructorId', as: 'courses' });
Course.belongsTo(User, { foreignKey: 'instructorId', as: 'instructor' });

module.exports = Course;