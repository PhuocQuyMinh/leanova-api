const Review = require('./review.model');
const Course = require('./course.model');
const User = require('../users/user.model');
const Enrollment = require('../store/enrollment.model');
const sequelize = require('../../core/database/init.mysql');
const AppError = require('../../core/utils/appError');

// 1. Học viên đánh giá khóa học
exports.addOrUpdateReview = async (userId, courseId, rating, comment) => {
    // Ktra 1: Chỉ người đã mua/ghi danh mới được đánh giá (Chống review bẩn)
    const isEnrolled = await Enrollment.findOne({ where: { userId, courseId } });
    if (!isEnrolled) throw new AppError('Bạn phải sở hữu khóa học này mới được đánh giá!', 403);

    const t = await sequelize.transaction();

    try {
        // Tìm xem user này đã review chưa. Có thì update, chưa thì tạo mới
        let [review, created] = await Review.findOrCreate({
            where: { userId, courseId },
            defaults: { rating, comment },
            transaction: t
        });

        if (!created) {
            review.rating = rating;
            review.comment = comment;
            await review.save({ transaction: t });
        }

        // TÍNH TOÁN LẠI ĐIỂM TRUNG BÌNH BẰNG SQL AGGREGATE
        // Lệnh này tương đương: SELECT AVG(rating), COUNT(id) FROM reviews WHERE courseId = ?
        const stats = await Review.findAll({
            where: { courseId },
            attributes: [
                [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'totalReviews']
            ],
            raw: true,
            transaction: t
        });

        // Làm tròn điểm số (VD: 4.6666 -> 4.7)
        const newAvg = Math.round(stats[0].avgRating * 10) / 10;
        const newCount = stats[0].totalReviews;

        // Lưu lại kết quả vào bảng Course để truy xuất siêu nhanh
        await Course.update(
            { averageRating: newAvg, reviewCount: newCount },
            { where: { id: courseId }, transaction: t }
        );

        await t.commit();
        return { message: created ? 'Đã thêm đánh giá!' : 'Đã cập nhật đánh giá!', review, newAvg, newCount };
    } catch (error) {
        await t.rollback();
        throw new AppError('Có lỗi xảy ra khi xử lý đánh giá!', 500);
    }
};

// 2. Lấy danh sách đánh giá của một khóa học (Public)
exports.getCourseReviews = async (courseId) => {
    return await Review.findAll({
        where: { courseId },
        include: [{ model: User, attributes: ['fullName'] }], // Kèm tên người đánh giá
        order: [['createdAt', 'DESC']] // Đánh giá mới nhất lên đầu
    });
};

// 3. Học viên tự xóa đánh giá của mình
exports.deleteReview = async (userId, reviewId) => {
    // 1. Tìm đánh giá
    const review = await Review.findByPk(reviewId);
    if (!review) {
        throw new AppError('Không tìm thấy đánh giá này!', 404);
    }

    // 2. Ràng buộc bảo mật: Chỉ tác giả mới được xóa
    if (review.userId !== userId) {
        throw new AppError('Lỗi bảo mật: Bạn chỉ có quyền xóa đánh giá của chính mình!', 403);
    }

    const courseId = review.courseId;
    const t = await sequelize.transaction();

    try {
        // 3. Xóa đánh giá khỏi database
        await review.destroy({ transaction: t });

        // 4. TÍNH TOÁN LẠI ĐIỂM TRUNG BÌNH SAU KHI XÓA
        const stats = await Review.findAll({
            where: { courseId },
            attributes: [
                [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'totalReviews']
            ],
            raw: true,
            transaction: t
        });

        // Xử lý trường hợp nếu học viên này là người duy nhất đánh giá (xóa xong là bằng 0)
        const totalReviews = parseInt(stats[0].totalReviews) || 0;
        const newAvg = totalReviews > 0 ? Math.round(parseFloat(stats[0].avgRating) * 10) / 10 : 0.0;

        // 5. Cập nhật lại điểm số chuẩn vào bảng Course
        await Course.update(
            { averageRating: newAvg, reviewCount: totalReviews },
            { where: { id: courseId }, transaction: t }
        );

        await t.commit();
        return { message: 'Đã xóa đánh giá thành công!' };
    } catch (error) {
        await t.rollback();
        throw new AppError('Có lỗi xảy ra khi xóa đánh giá!', 500);
    }
};