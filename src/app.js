const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const errorHandler = require('./core/middlewares/errorHandler');
const AppError = require('./core/utils/appError');

const app = express();

// 1. Global Middlewares
app.use(helmet()); // Bảo vệ HTTP headers
app.use(cors());   // Cho phép Frontend gọi API
app.use(express.json()); // Đọc data JSON từ body
app.use(morgan('dev')); // Log request ra console

// Import các file routes
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/user.routes');
const courseRoutes = require('./modules/courses/course.routes');
const moderationRoutes = require('./modules/moderation/moderation.routes');
const storeRoutes = require('./modules/store/store.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const categoryRoutes = require('./modules/categories/category.routes');
const financeRoutes = require('./modules/finance/finance.routes');
const qaRoutes = require('./modules/qa/qa.routes');
const instructorDashboardRoutes = require('./modules/dashboard/instructor_dashboard.routes');
const notificationRoutes = require('./modules/notifications/notification.routes');


// 2. Routes
app.get('/api/healthcheck', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Hệ thống Leanova đang hoạt động tốt!' });
});

// Cắm route auth vào hệ thống
app.use('/api/auth', authRoutes);

// Cắm route (Nằm dưới route auth)
app.use('/api/users', userRoutes);

app.use('/api/courses', courseRoutes);

app.use('/api/moderation', moderationRoutes);

app.use('/api/store', storeRoutes);

app.use('/api/dashboard', dashboardRoutes);

app.use('/api/categories', categoryRoutes);

app.use('/api/finance', financeRoutes);

app.use('/api/qa', qaRoutes);

app.use('/api/instructor', instructorDashboardRoutes);

app.use('/api/notification', notificationRoutes);

// 3. Xử lý đường dẫn không tồn tại (404)
app.use((req, res, next) => {
    next(new AppError(`Không tìm thấy đường dẫn ${req.originalUrl} trên hệ thống!`, 404));
});

// 4. Global Error Handler (Luôn nằm ở cuối cùng)
app.use(errorHandler);

module.exports = app;