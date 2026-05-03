const express = require('express');
const courseController = require('./course.controller');
const authMiddleware = require('../../core/middlewares/auth.middleware');

const router = express.Router();

// Lớp bảo vệ 1: Phải đăng nhập
router.use(authMiddleware.protect);

// Các API bên dưới, ngoài việc đăng nhập, còn phải đi qua lớp bảo vệ 2: Chỉ Giảng viên hoặc Admin mới được phép
router.post('/', authMiddleware.restrictTo('Instructor', 'Admin'), courseController.createCourse);
router.get('/my-courses', authMiddleware.restrictTo('Instructor', 'Admin'), courseController.getMyCourses);

module.exports = router;