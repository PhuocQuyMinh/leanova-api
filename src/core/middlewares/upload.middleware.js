const multer = require('multer');
const fs = require('fs');
const path = require('path');

// 1. Tạo thư mục 'uploads' ở ngoài cùng dự án (nếu chưa có)
const uploadDir = path.join(__dirname, '../../../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Cấu hình Multer lưu file vào thư mục tạm này
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Đổi tên file thêm chuỗi thời gian để không bị trùng lặp đè lên nhau
        const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
        cb(null, uniqueName);
    }
});

const upload = multer({ storage: storage });
module.exports = upload;