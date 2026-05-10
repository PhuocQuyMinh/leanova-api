const multer = require('multer');
const fs = require('fs');
const path = require('path');
const AppError = require('../utils/appError');

// 1. Khởi tạo thư mục dùng chung
const uploadDir = path.join(__dirname, '../../../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Cấu hình Storage dùng chung (Lưu vào cùng 1 chỗ, cùng cách đặt tên)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
        cb(null, uniqueName);
    }
});

// 3. THUẬT TOÁN FACTORY: Tạo ra các bộ Upload động
const createUploader = (allowedTypes, maxFileSizeMB) => {
    return multer({
        storage: storage,
        limits: { fileSize: maxFileSizeMB * 1024 * 1024 }, // Chuyển MB thành Byte
        fileFilter: (req, file, cb) => {
            // Tránh lỗi nếu allowedTypes không được truyền vào (Mặc định cho phép tất cả)
            if (!allowedTypes || allowedTypes.length === 0) {
                return cb(null, true);
            }

            // Kiểm tra mimetype của file gửi lên có nằm trong mảng cho phép không
            // (Dùng startsWith để bắt được toàn bộ 'image/png', 'image/jpeg' chỉ bằng chữ 'image/')
            const isAllowed = allowedTypes.some(type => file.mimetype.startsWith(type));

            if (isAllowed) {
                cb(null, true); // Hợp lệ -> Cho đi tiếp
            } else {
                cb(new AppError(`Định dạng file không hỗ trợ! Hệ thống chỉ nhận: ${allowedTypes.join(', ')}`, 400), false); // Lỗi -> Chặn lại
            }
        }
    });
};

// 4. XUẤT RA CÁC "GÓI" UPLOAD DÀNH CHO TỪNG TÍNH NĂNG
module.exports = {
    // Gói 1: Dùng cho Đăng ký giảng viên (Chỉ Ảnh + PDF, Tối đa 5MB)
    uploadCertificate: createUploader(['image/', 'application/pdf'], 5),

    // Gói 2: Dùng cho Đổi ảnh đại diện (Chỉ Ảnh, Tối đa 2MB)
    uploadAvatar: createUploader(['image/'], 2),

    // Gói 3: Dùng cho Video bài học (Chỉ Video, Tối đa 500MB)
    uploadVideo: createUploader(['video/'], 500),

    // Gói 4: Dùng cho Tài liệu đính kèm khóa học (Cho phép file Zip, Word, PDF..., Tối đa 50MB)
    uploadAttachment: createUploader(['application/', 'text/', 'image/'], 50),

    // Gói 5: Gói mở rộng, upload tự do không giới hạn định dạng (chỉ chặn quá 100MB)
    uploadFree: createUploader([], 100)
};