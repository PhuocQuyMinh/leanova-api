const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');
const User = require('../users/user.model');

const Testimonial = sequelize.define('Testimonial', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Nội dung đánh giá không được để trống' }
        }
    },
    rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
            max: 5
        },
        defaultValue: 5
    },
    status: {
        type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
        defaultValue: 'Pending',
        comment: 'Trạng thái duyệt hiển thị trang chủ'
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    }
}, {
    tableName: 'testimonials',
    timestamps: true // Tự động tạo createdAt, updatedAt
});

// Quan hệ (Relationships)
User.hasMany(Testimonial, { foreignKey: 'userId', as: 'testimonials' });
Testimonial.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = Testimonial;