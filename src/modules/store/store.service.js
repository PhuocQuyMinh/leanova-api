const Course = require('../courses/course.model');
const Section = require('../courses/section.model');
const Lesson = require('../courses/lesson.model');
const Attachment = require('../courses/attachment.model');
const Quiz = require('../courses/quiz.model');
const User = require('../users/user.model');
const CartItem = require('./cart_item.model');
const Enrollment = require('./enrollment.model');
const sequelize = require('../../core/database/init.mysql');
const AppError = require('../../core/utils/appError');
const LessonProgress = require('./lesson_progress.model');
const QuizQuestion = require('../courses/quiz_question.model');
const QuizAttempt = require('./quiz_attempt.model');

// 1. Cửa hàng: Lấy danh sách khóa học đang bán
exports.getPublishedCourses = async () => {
    return await Course.findAll({
        where: { status: 'Published' },
        attributes: ['id', 'title', 'price', 'coverImage'], // Chỉ lấy các cột cần thiết cho giao diện thẻ (card)
        include: [{ model: User, as: 'instructor', attributes: ['fullName'] }]
    });
};

// 2. Cửa hàng: Xem chi tiết khóa học (CÓ CHE DẤU NỘI DUNG BẢN QUYỀN)
exports.getCourseDetailPublic = async (courseId) => {
    const course = await Course.findOne({
        where: { id: courseId, status: 'Published' },
        include: [
            { model: User, as: 'instructor', attributes: ['fullName', 'email'] },
            {
                model: Section, as: 'sections',
                include: [{
                    model: Lesson, as: 'lessons',
                    // Che dấu nội dung: Chỉ trả về title, loại bài học, thời lượng và quyền xem thử
                    attributes: ['id', 'title', 'lessonType', 'durationString', 'isPreviewable', 'orderIndex', 'videoUrl', 'articleContent']
                }]
            }
        ],
        order: [
            [{ model: Section, as: 'sections' }, 'orderIndex', 'ASC'],
            [{ model: Section, as: 'sections' }, { model: Lesson, as: 'lessons' }, 'orderIndex', 'ASC']
        ]
    });

    if (!course) throw new AppError('Khóa học không tồn tại hoặc chưa được xuất bản!', 404);

    // XỬ LÝ ẨN NỘI DUNG (Cực kỳ quan trọng để chống học chùa)
    // Chuyển instance của Sequelize thành object JSON thường để dễ chỉnh sửa
    const courseData = course.toJSON();

    courseData.sections.forEach(section => {
        section.lessons.forEach(lesson => {
            if (!lesson.isPreviewable) {
                // Nếu không cho xem thử -> Xóa URL video và nội dung bài đọc trước khi gửi về Client
                delete lesson.videoUrl;
                delete lesson.articleContent;
            }
        });
    });

    return courseData;
};

// 3. Giỏ hàng: Thêm khóa học
exports.addToCart = async (userId, courseId) => {
    // Ktra xem khóa học có bán không
    const course = await Course.findOne({ where: { id: courseId, status: 'Published' } });
    if (!course) throw new AppError('Khóa học không tồn tại!', 404);

    // Ktra xem đã mua chưa
    const isEnrolled = await Enrollment.findOne({ where: { userId, courseId } });
    if (isEnrolled) throw new AppError('Bạn đã sở hữu khóa học này rồi!', 400);

    // Ktra xem đã có trong giỏ chưa
    const isReadyInCart = await CartItem.findOne({ where: { userId, courseId } });
    if (isReadyInCart) throw new AppError('Khóa học này đã có trong giỏ hàng!', 400);

    return await CartItem.create({ userId, courseId });
};

// 4. Giỏ hàng: Xem giỏ hàng
exports.getMyCart = async (userId) => {
    return await CartItem.findAll({
        where: { userId },
        include: [{ model: Course, attributes: ['id', 'title', 'price', 'coverImage'] }]
    });
};

// 5. Thanh toán (Tạo Enrollment & Xóa Giỏ hàng bằng Transaction)
exports.checkout = async (userId) => {
    const cartItems = await CartItem.findAll({ where: { userId } });
    if (cartItems.length === 0) throw new AppError('Giỏ hàng của bạn đang trống!', 400);

    const t = await sequelize.transaction();

    try {
        // Tạo mảng dữ liệu để nạp vào bảng Enrollment
        const enrollmentsData = cartItems.map(item => ({
            userId: userId,
            courseId: item.courseId
        }));

        // 1. Ghi danh (Cấp quyền sở hữu khóa học)
        await Enrollment.bulkCreate(enrollmentsData, { transaction: t });

        // 2. Làm sạch giỏ hàng của User này
        await CartItem.destroy({ where: { userId }, transaction: t });

        await t.commit();
        return { message: 'Thanh toán thành công! Khóa học đã được thêm vào tủ sách của bạn.' };
    } catch (error) {
        await t.rollback();
        throw new AppError('Có lỗi xảy ra trong quá trình thanh toán!', 500);
    }
};

// 6. Không gian học tập: Lấy danh sách khóa học đã sở hữu (My Learning)
exports.getMyEnrollments = async (userId) => {
    return await Enrollment.findAll({
        where: { userId },
        include: [{
            model: Course,
            attributes: ['id', 'title', 'coverImage'], // Trả về thông tin cơ bản để vẽ giao diện thẻ
            include: [{ model: User, as: 'instructor', attributes: ['fullName'] }]
        }]
    });
};

// 7. Không gian học tập: Vào học (Xem full toàn bộ cấu trúc không che giấu)
exports.getEnrolledCourseDetail = async (userId, courseId) => {
    // 1. Kiểm tra tấm vé vào cửa (Có đúng là đã mua/được ghi danh chưa?)
    const isEnrolled = await Enrollment.findOne({ where: { userId, courseId } });
    if (!isEnrolled) throw new AppError('Bạn chưa sở hữu khóa học này! Vui lòng mua để truy cập.', 403);

    // 2. Trả về toàn bộ nội dung (Bao gồm cả Video URL và Tài liệu đính kèm)
    const course = await Course.findByPk(courseId, {
        include: [
            {
                model: Section, as: 'sections',
                include: [
                    {
                        model: Lesson, as: 'lessons',
                        include: [{ model: Attachment, as: 'attachments' }] // Full tài liệu đính kèm
                    },
                    { model: Quiz, as: 'quizzes' } // Full trắc nghiệm
                ]
            }
        ],
        order: [
            [{ model: Section, as: 'sections' }, 'orderIndex', 'ASC'],
            [{ model: Section, as: 'sections' }, { model: Lesson, as: 'lessons' }, 'orderIndex', 'ASC']
        ]
    });

    return course;
};


// 8. Đánh dấu hoàn thành bài học và Tính lại tiến độ
exports.toggleLessonComplete = async (userId, courseId, lessonId) => {
    // 1. Kiểm tra quyền sở hữu
    const enrollment = await Enrollment.findOne({ where: { userId, courseId } });
    if (!enrollment) throw new AppError('Bạn chưa sở hữu khóa học này!', 403);

    // 2. Tìm hoặc tạo mới bản ghi tiến độ cho bài học này
    let [progress, created] = await LessonProgress.findOrCreate({
        where: { userId, lessonId },
        defaults: { isCompleted: true }
    });

    // Nếu đã có sẵn thì đổi trạng thái (chưa xong -> xong, hoặc ngược lại)
    if (!created) {
        progress.isCompleted = !progress.isCompleted;
        await progress.save();
    }

    // 3. THUẬT TOÁN TÍNH PHẦN TRĂM (%)
    // Lấy toàn bộ bài học của khóa học này để đếm
    const course = await Course.findByPk(courseId, {
        include: [{
            model: Section, as: 'sections',
            include: [{ model: Lesson, as: 'lessons', attributes: ['id'] }]
        }]
    });

    let totalLessons = 0;
    const lessonIds = []; // Mảng chứa ID của tất cả bài học trong khóa

    course.sections.forEach(section => {
        totalLessons += section.lessons.length;
        section.lessons.forEach(lesson => lessonIds.push(lesson.id));
    });

    // Nếu khóa học chưa có bài học nào
    if (totalLessons === 0) return { message: 'Đã cập nhật trạng thái!', progressPercent: 0 };

    // Đếm số bài học user đã hoàn thành trong mảng lessonIds kia
    const completedLessons = await LessonProgress.count({
        where: {
            userId: userId,
            lessonId: lessonIds,
            isCompleted: true
        }
    });

    // Tính % và làm tròn
    const progressPercent = Math.round((completedLessons / totalLessons) * 100);

    // Lưu lại % vào bảng Ghi danh (Enrollment)
    enrollment.progressPercent = progressPercent;
    await enrollment.save();

    return {
        message: progress.isCompleted ? 'Đã hoàn thành bài học!' : 'Đã bỏ đánh dấu hoàn thành!',
        completedLessons,
        totalLessons,
        progressPercent
    };
};

// 9. Nộp bài và Tự động chấm điểm
exports.submitQuiz = async (userId, quizId, userAnswers) => {
    // userAnswers là mảng client gửi lên: [{ questionId: 1, selectedChoiceId: 2 }, ...]

    const quiz = await Quiz.findByPk(quizId, {
        include: [{ model: QuizQuestion, as: 'questions' }]
    });

    if (!quiz) throw new AppError('Không tìm thấy bài kiểm tra này!', 404);
    if (quiz.questions.length === 0) throw new AppError('Bài kiểm tra này chưa có câu hỏi nào!', 400);

    let correctCount = 0;
    const totalQuestions = quiz.questions.length;

    // THUẬT TOÁN CHẤM ĐIỂM
    quiz.questions.forEach(question => {
        // Tìm câu trả lời của user cho câu hỏi này
        const userAnswer = userAnswers.find(ans => ans.questionId === question.id);

        if (userAnswer) {
            // Lấy danh sách đáp án từ DB
            const choices = typeof question.choices === 'string' ? JSON.parse(question.choices) : question.choices;

            // Tìm đáp án đúng từ DB
            const correctChoice = choices.find(c => c.isCorrect === true);

            // So khớp đáp án user chọn với đáp án đúng
            if (correctChoice && correctChoice.id === userAnswer.selectedChoiceId) {
                correctCount++;
            }
        }
    });

    // Tính điểm và xét điều kiện qua môn
    const scorePercent = Math.round((correctCount / totalQuestions) * 100);
    const isPassed = scorePercent >= quiz.passingScorePercent;

    // Lưu lại lịch sử làm bài
    const attempt = await QuizAttempt.create({
        userId,
        quizId,
        scorePercent,
        isPassed
    });

    return {
        message: isPassed ? 'Chúc mừng! Bạn đã qua bài kiểm tra.' : 'Rất tiếc, bạn cần cố gắng hơn!',
        correctCount,
        totalQuestions,
        scorePercent,
        isPassed,
        passingScore: quiz.passingScorePercent
    };
};