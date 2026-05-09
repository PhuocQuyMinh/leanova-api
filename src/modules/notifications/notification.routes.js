const express = require('express');
const notifController = require('./notification.controller');
const authMiddleware = require('../../core/middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware.protect); // Bắt buộc đăng nhập

router.get('/', notifController.getMyNotifications);
router.patch('/read-all', notifController.markAllAsRead);
router.patch('/:id/read', notifController.markAsRead);

module.exports = router;