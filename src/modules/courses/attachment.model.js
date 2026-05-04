const { DataTypes } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');

const Attachment = sequelize.define('Attachment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    // Tên file hiển thị (VD: "Slide-Bai-1.pdf", "SourceCode.zip")
    fileName: { type: DataTypes.STRING, allowNull: false },

    // URL tải file (Lưu trên Cloudinary raw file hoặc AWS S3)
    fileUrl: { type: DataTypes.STRING, allowNull: false },

    // Kích thước file (để hiển thị trên UI, VD: "2.5 MB")
    fileSizeString: { type: DataTypes.STRING, allowNull: true }
}, {
    tableName: 'attachments',
    timestamps: true
});

module.exports = Attachment;