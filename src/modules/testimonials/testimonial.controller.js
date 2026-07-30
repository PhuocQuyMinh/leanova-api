const TestimonialService = require('./testimonial.service');

class TestimonialController {
    // [POST] /api/testimonials
    static async create(req, res, next) {
        try {
            // Giả sử userId được lấy từ token (middleware auth gắn vào req.user)
            const userId = req.user.id;
            const data = req.body;

            const result = await TestimonialService.createTestimonial(userId, data);

            return res.status(201).json({
                success: true,
                message: 'Gửi đánh giá thành công, đang chờ kiểm duyệt',
                data: result
            });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // [GET] /api/testimonials (Dành cho trang chủ)
    static async getPublicList(req, res, next) {
        try {
            const { page, limit } = req.query;
            const result = await TestimonialService.getPublicTestimonials(page, limit);

            return res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // [GET] /api/testimonials/admin (Dành cho Admin Dashboard)
    static async getAdminList(req, res, next) {
        try {
            const { status, page, limit } = req.query;
            const result = await TestimonialService.getAdminTestimonials(status, page, limit);

            return res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // [PATCH] /api/testimonials/admin/:id/status
    static async updateStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status } = req.body; // 'Approved' hoặc 'Rejected'

            const result = await TestimonialService.updateStatus(id, status);

            return res.status(200).json({
                success: true,
                message: 'Cập nhật trạng thái thành công',
                data: result
            });
        } catch (error) {
            return res.status(400).json({ success: false, message: error.message });
        }
    }
}

module.exports = TestimonialController;