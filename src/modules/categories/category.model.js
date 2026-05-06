const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');

const Category = sequelize.define('Category', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    parentId: {
        type: DataTypes.INTEGER,
        allowNull: true, // Nếu null thì đây là danh mục gốc (Ví dụ: Kỹ thuật, Nghệ thuật)
        references: {
            model: 'Categories',
            key: 'id'
        }
    }
}, {
    tableName: 'Categories',
    timestamps: true,
});

// Định nghĩa quan hệ tự tham chiếu (Self-referencing) ngay trong model
Category.hasMany(Category, { as: 'children', foreignKey: 'parentId' });
Category.belongsTo(Category, { as: 'parent', foreignKey: 'parentId' });

module.exports = Category;