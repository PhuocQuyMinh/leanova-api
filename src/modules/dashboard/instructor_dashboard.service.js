const { Op } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');
const Course = require('../courses/course.model');
const Section = require('../courses/section.model');
const Lesson = require('../courses/lesson.model');
const Enrollment = require('../store/enrollment.model');
const Review = require('../courses/review.model');
const LessonProgress = require('../store/lesson_progress.model');
const AppError = require('../../core/utils/appError');
const User = require('../users/user.model');
const notifService = require('../notifications/notification.service'); // Bổ sung dòng này

// ==========================================
// 1. THỐNG KÊ TỔNG QUAN (TẤT CẢ KHÓA HỌC)
// ==========================================
exports.getGlobalStats = async (instructorId) => {
    // 1. Lấy danh sách ID các khóa học của giảng viên này
    const courses = await Course.findAll({
        where: { instructorId },
        attributes: ['id']
    });

    const courseIds = courses.map(c => c.id);

    if (courseIds.length === 0) {
        return { totalEnrollments: 0, uniqueStudents: 0, averageRating: 0 };
    }

    // 2. Tổng số lượt đăng ký (1 người mua 2 khóa tính là 2)
    const totalEnrollments = await Enrollment.count({
        where: { courseId: { [Op.in]: courseIds } }
    });

    // 3. Tổng số học viên duy nhất (1 người mua 2 khóa tính là 1)
    const uniqueStudents = await Enrollment.count({
        where: { courseId: { [Op.in]: courseIds } },
        distinct: true,
        col: 'userId'
    });

    // 4. Điểm đánh giá trung bình
    const ratingData = await Review.findOne({
        where: { courseId: { [Op.in]: courseIds } },
        attributes: [
            [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'totalReviews']
        ]
    });

    const averageRating = parseFloat(ratingData.getDataValue('avgRating')) || 0;
    const totalReviews = parseInt(ratingData.getDataValue('totalReviews')) || 0;

    return {
        totalEnrollments,
        uniqueStudents,
        averageRating: parseFloat(averageRating.toFixed(1)), // Làm tròn 1 chữ số thập phân (VD: 4.5)
        totalReviews
    };
};

// ==========================================
// 2. THỐNG KÊ CHI TIẾT 1 KHÓA HỌC (PHỄU BÀI HỌC)
// ==========================================
exports.getCourseSpecificStats = async (instructorId, courseId) => {
    // 1. Kiểm tra quyền sở hữu
    const course = await Course.findOne({ where: { id: courseId, instructorId } });
    if (!course) throw new AppError('Khóa học không tồn tại hoặc bạn không có quyền truy cập!', 403);

    // 2. Tổng số học viên & Tỉ lệ hoàn thành trung bình
    const enrollmentData = await Enrollment.findOne({
        where: { courseId },
        attributes: [
            [sequelize.fn('COUNT', sequelize.col('userId')), 'totalStudents'],
            [sequelize.fn('AVG', sequelize.col('progressPercent')), 'avgProgress']
        ]
    });

    const totalStudents = parseInt(enrollmentData.getDataValue('totalStudents')) || 0;
    const averageProgress = parseFloat(enrollmentData.getDataValue('avgProgress')) || 0;

    // 3. THUẬT TOÁN TÌM ĐIỂM RƠI (DROP-OFF):
    // Lấy toàn bộ cây bài học để biết thứ tự
    const sections = await Section.findAll({
        where: { courseId },
        attributes: ['id', 'title', 'orderIndex'],
        include: [{
            model: Lesson, as: 'lessons',
            attributes: ['id', 'title', 'orderIndex']
        }],
        order: [
            ['orderIndex', 'ASC'],
            [{ model: Lesson, as: 'lessons' }, 'orderIndex', 'ASC']
        ]
    });

    // Gom ID các bài học lại
    const lessonIds = [];
    sections.forEach(sec => sec.lessons.forEach(les => lessonIds.push(les.id)));

    // Đếm số người đã hoàn thành ở từng bài học
    const progressData = await LessonProgress.findAll({
        where: {
            lessonId: { [Op.in]: lessonIds },
            isCompleted: true
        },
        attributes: [
            'lessonId',
            [sequelize.fn('COUNT', sequelize.col('userId')), 'completedCount']
        ],
        group: ['lessonId']
    });

    // Map lại dữ liệu dạng Key-Value để tra cứu nhanh { lessonId: count }
    const progressMap = {};
    progressData.forEach(item => {
        progressMap[item.lessonId] = parseInt(item.getDataValue('completedCount'));
    });

    // Lắp ghép dữ liệu hoàn chỉnh để Frontend vẽ biểu đồ Phễu (Funnel Chart)
    const curriculumFunnel = sections.map(sec => ({
        sectionId: sec.id,
        sectionTitle: sec.title,
        lessons: sec.lessons.map(les => {
            const completed = progressMap[les.id] || 0;
            // Tính tỉ lệ drop-off so với tổng số học sinh mua khóa
            const completionRate = totalStudents > 0 ? Math.round((completed / totalStudents) * 100) : 0;

            return {
                lessonId: les.id,
                lessonTitle: les.title,
                completedStudents: completed,
                completionRatePercent: completionRate
            };
        })
    }));

    return {
        courseId: course.id,
        courseTitle: course.title,
        averageRating: course.averageRating,
        reviewCount: course.reviewCount,
        totalStudents,
        averageProgress: Math.round(averageProgress),
        curriculumFunnel // Cục data siêu xịn để vẽ biểu đồ
    };
};

// ==========================================
// 3. THỐNG KÊ THEO GIAI ĐOẠN (PERIODIC STATS)
// ==========================================
exports.getPeriodicStats = async (instructorId, startDate, endDate) => {
    // 1. Lấy danh sách ID các khóa học của giảng viên
    const courses = await Course.findAll({
        where: { instructorId },
        attributes: ['id']
    });
    const courseIds = courses.map(c => c.id);

    if (courseIds.length === 0) return { newEnrollments: 0, completedStudents: 0, newReviews: 0 };

    // Thiết lập mốc thời gian (00:00:00 của ngày bắt đầu và 23:59:59 của ngày kết thúc)
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 2. Số học viên mới (Đăng ký trong khoảng thời gian này)
    const newEnrollments = await Enrollment.count({
        where: {
            courseId: { [Op.in]: courseIds },
            createdAt: { [Op.between]: [start, end] }
        }
    });

    // 3. Số học viên hoàn thành (Đạt 100% tiến độ trong khoảng thời gian này)
    const completedStudents = await Enrollment.count({
        where: {
            courseId: { [Op.in]: courseIds },
            progressPercent: 100,
            updatedAt: { [Op.between]: [start, end] } // Dựa trên thời điểm cập nhật tiến độ cuối cùng
        }
    });

    // 4. Số đánh giá mới
    const newReviews = await Review.count({
        where: {
            courseId: { [Op.in]: courseIds },
            createdAt: { [Op.between]: [start, end] }
        }
    });

    return {
        period: { startDate, endDate },
        stats: {
            newEnrollments,
            completedStudents,
            newReviews
        }
    };
};

// ==========================================
// 4. QUẢN LÝ REVIEW
// ==========================================
// 1. Giảng viên lấy toàn bộ review của các khóa học mình sở hữu
exports.getInstructorReviews = async (instructorId) => {
    const courses = await Course.findAll({ where: { instructorId }, attributes: ['id'] });
    const courseIds = courses.map(c => c.id);

    return await Review.findAll({
        where: { courseId: { [Op.in]: courseIds } },
        include: [
            { model: User, attributes: ['id', 'fullName', 'email'] }, // Kèm ID để báo cáo nếu cần
            { model: Course, attributes: ['title'] }
        ],
        order: [['createdAt', 'DESC']]
    });
};

// 2. Giảng viên phản hồi Review
exports.replyToReview = async (instructorId, reviewId, replyContent) => {
    const review = await Review.findByPk(reviewId, {
        include: [{ model: Course }]
    });

    if (!review || review.Course.instructorId !== instructorId) {
        throw new AppError('Bạn không có quyền phản hồi đánh giá này!', 403);
    }

    review.instructorReply = replyContent;
    review.repliedAt = new Date();
    await review.save();
    return review;
};

// 2.1. Giảng viên cập nhật (sửa) phản hồi đã gửi
exports.updateReply = async (instructorId, reviewId, replyContent) => {
    const review = await Review.findByPk(reviewId, {
        include: [{ model: Course }]
    });

    if (!review || review.Course.instructorId !== instructorId) {
        throw new AppError('Bạn không có quyền sửa phản hồi này!', 403);
    }

    if (!review.instructorReply) {
        throw new AppError('Bạn chưa có phản hồi nào cho đánh giá này để sửa!', 400);
    }

    review.instructorReply = replyContent;
    review.repliedAt = new Date(); // Cập nhật lại thời gian sửa
    await review.save();

    return review;
};

// 2.2. Giảng viên xóa phản hồi của mình
exports.deleteReply = async (instructorId, reviewId) => {
    const review = await Review.findByPk(reviewId, {
        include: [{ model: Course }]
    });

    if (!review || review.Course.instructorId !== instructorId) {
        throw new AppError('Bạn không có quyền xóa phản hồi này!', 403);
    }

    // Set lại giá trị null cho nội dung và thời gian phản hồi
    review.instructorReply = null;
    review.repliedAt = null;
    await review.save();

    return review;
};

// 3. Giảng viên báo cáo Review vi phạm
exports.reportReview = async (instructorId, reviewId, reason) => {
    const review = await Review.findByPk(reviewId, {
        include: [{ model: Course }]
    });

    if (!review || review.Course.instructorId !== instructorId) {
        throw new AppError('Bạn không có quyền báo cáo đánh giá này!', 403);
    }

    review.isReported = true;
    review.reportReason = reason;
    await review.save();

    // ==========================================
    // [MỚI] GỬI THÔNG BÁO CHO MODERATOR/ADMIN
    // ==========================================
    try {
        // Lấy thông tin giảng viên để hiển thị tên
        const instructor = await User.findByPk(instructorId, { attributes: ['fullName'] });
        const instructorName = instructor ? instructor.fullName : 'Một giảng viên';

        // Lấy danh sách tài khoản Mod và Admin
        const moderators = await User.findAll({
            where: {
                role: {
                    [Op.in]: ['Moderator']
                }
            },
            attributes: ['id']
        });

        if (moderators.length > 0) {
            const notificationPromises = moderators.map(mod =>
                notifService.pushNotification({
                    userId: mod.id,
                    title: 'Có báo cáo vi phạm mới',
                    message: `Giảng viên ${instructorName} vừa báo cáo một đánh giá vi phạm trong khóa học "${review.Course.title}". Lý do: "${reason}". Vui lòng kiểm tra.`,
                    type: 'System',
                    actionUrl: `/admin/reported-reviews`, // Dẫn Mod vào thẳng trang danh sách báo cáo
                    isSendEmail: true
                })
            );

            // Gửi đồng loạt tất cả thông báo
            await Promise.all(notificationPromises);
        }
    } catch (notifError) {
        // Lỗi gửi mail không được làm sập tính năng báo cáo của giảng viên
        console.error('Lỗi gửi thông báo cho Mod khi có review bị báo cáo:', notifError);
    }
    // ==========================================

    return review;
};

// 4. Mod/Admin xử lý báo cáo (Xóa review hoặc từ chối)
exports.handleReviewReport = async (reviewId, action, modNote) => {
    const review = await Review.findByPk(reviewId);
    if (!review) throw new AppError('Đánh giá không tồn tại!', 404);

    if (action === 'delete') {
        // Trước khi xóa, ta có thể lấy userId của người review để Admin cân nhắc ban
        const userIdToBan = review.userId;
        await review.destroy();
        return { message: 'Đánh giá đã bị xóa.', userIdToBan };
    }

    review.isReported = false;
    review.modNote = modNote;
    await review.save();
    return { message: 'Yêu cầu xóa bị từ chối.', review };
};

// ==========================================
// NHÓM API DÀNH CHO KIỂM DUYỆT VIÊN (MOD/ADMIN)
// ==========================================

// 5. Lấy danh sách các Review bị giảng viên báo cáo
exports.getReportedReviews = async () => {
    return await Review.findAll({
        where: { isReported: true },
        // Lấy luôn thông tin Học viên và Khóa học để Mod dễ đối chiếu
        include: [
            {
                model: User,
                // Không dùng 'as' vì trong định nghĩa Review.belongsTo(User) bạn không đặt 'as'
                attributes: ['id', 'fullName', 'email', 'isActive', 'lockReason']
            },
            {
                model: Course,
                attributes: ['id', 'title', 'instructorId']
            }
        ],
        // Sắp xếp theo thời gian cập nhật cũ nhất lên đầu để Mod xử lý trước
        order: [['updatedAt', 'ASC']]
    });
};