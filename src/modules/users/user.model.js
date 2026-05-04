const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../../core/database/init.mysql');

const InstructorRequest = require('../moderation/instructor_request.model');
const CartItem = require('../store/cart_item.model');
const Enrollment = require('../store/enrollment.model');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    fullName: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Họ và tên không được để trống' }
        }
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: { msg: 'Email này đã được sử dụng' },
        validate: {
            isEmail: { msg: 'Định dạng email không hợp lệ' }
        }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            min: { args: [6], msg: 'Mật khẩu phải có ít nhất 6 ký tự' }
        }
    },
    role: {
        type: DataTypes.ENUM('Student', 'Instructor', 'Mod', 'Admin'),
        defaultValue: 'Student'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'users',
    timestamps: true, // Tự động thêm createdAt, updatedAt
    hooks: {
        // Tự động băm mật khẩu trước khi lưu (Create) hoặc cập nhật (Update)
        beforeSave: async (user) => {
            if (user.changed('password')) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        }
    }
});

// Thêm một method (hàm) riêng cho model để kiểm tra mật khẩu lúc đăng nhập
User.prototype.correctPassword = async function (candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

// Một User có thể nộp đơn nhiều lần (nếu bị rớt), nhưng mỗi lần duyệt 1 đơn
User.hasMany(InstructorRequest, { foreignKey: 'userId', as: 'instructorRequests' });
InstructorRequest.belongsTo(User, { foreignKey: 'userId', as: 'applicant' });

User.hasMany(CartItem, { foreignKey: 'userId', as: 'cart' });
CartItem.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Enrollment, { foreignKey: 'userId', as: 'enrollments' });
Enrollment.belongsTo(User, { foreignKey: 'userId' });

module.exports = User;