const express = require('express');
const dashboardController = require('./instructor_dashboard.controller');
const authMiddleware = require('../../core/middlewares/auth.middleware');

const router = express.Router();

// Bảo vệ bằng Token và Role
router.use(authMiddleware.protect);
router.use(authMiddleware.restrictTo('Instructor'));

// 1. Lấy dữ liệu tổng quan cho trang chủ Dashboard
router.get('/global-stats', dashboardController.getGlobalStats);

// 2. Lấy dữ liệu phân tích chi tiết của 1 khóa học
router.get('/courses/:courseId/stats', dashboardController.getCourseSpecificStats);

module.exports = router;