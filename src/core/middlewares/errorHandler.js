// Bất cứ lỗi nào lọt qua được hệ thống sẽ rơi vào đây, đảm bảo server không bị sập.
// Gửi về client mã lỗi và data
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log ra console để Dev dễ debug
    console.error('🔥 ERROR LOG:', err);

    res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
        // Chỉ hiện stack trace (chi tiết lỗi) khi đang ở môi trường Dev
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

module.exports = errorHandler;