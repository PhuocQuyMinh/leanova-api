const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');

const Review = sequelize.define('Review', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    courseId: { type: DataTypes.INTEGER, allowNull: false },
    rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1, max: 5 } // Ép buộc chỉ được vote từ 1 đến 5 sao
    },
    comment: { type: DataTypes.TEXT, allowNull: true },
    instructorReply: { type: DataTypes.TEXT, allowNull: true },
    repliedAt: { type: DataTypes.DATE, allowNull: true },

    // Luồng báo cáo/kiểm duyệt
    isReported: { type: DataTypes.BOOLEAN, defaultValue: false },
    reportReason: { type: DataTypes.TEXT, allowNull: true },
    modNote: { type: DataTypes.TEXT, allowNull: true } // Ghi chú của Mod khi xử lý
}, {
    tableName: 'reviews',
    timestamps: true
});

module.exports = Review;