const express = require('express');
const authController = require('./auth.controller');

const router = express.Router();

// Route đăng ký & Xác thực
router.post('/register', authController.register);
router.get('/verify-email', authController.verifyEmail);

// Route đăng nhập
router.post('/login', authController.login);
router.post('/google-login', authController.googleLogin);

module.exports = router;