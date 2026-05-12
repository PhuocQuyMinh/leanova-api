// favorites/favorite.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');
const Course = require('../courses/course.model');

const Favorite = sequelize.define('Favorite', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    courseId: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    tableName: 'favorites',
    timestamps: true,
    // Đảm bảo một user không thể favorite 1 khóa học 2 lần trong DB
    indexes: [{ unique: true, fields: ['userId', 'courseId'] }]
});

Favorite.belongsTo(Course, { foreignKey: 'courseId' });
Course.hasMany(Favorite, { foreignKey: 'courseId', as: 'favorites' });

module.exports = Favorite;