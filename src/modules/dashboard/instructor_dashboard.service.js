const { Op } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');
const Course = require('../courses/course.model');
const Section = require('../courses/section.model');
const Lesson = require('../courses/lesson.model');
const Enrollment = require('../store/enrollment.model');
const Review = require('../courses/review.model');
const LessonProgress = require('../store/lesson_progress.model');
const AppError = require('../../core/utils/appError');

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