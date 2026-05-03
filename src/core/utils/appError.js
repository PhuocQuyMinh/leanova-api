// Tạo một class kế thừa từ Error gốc của Node.js để phân loại lỗi rõ ràng.
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true; // Lỗi do mình lường trước (Ví dụ: sai pass)

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;