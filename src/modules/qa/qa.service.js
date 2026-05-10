const LessonQuestion = require('./lesson_question.model');
const LessonAnswer = require('./lesson_answer.model');
const Lesson = require('../courses/lesson.model');
const Section = require('../courses/section.model');
const Course = require('../courses/course.model');
const Enrollment = require('../store/enrollment.model');
const User = require('../users/user.model');
const AppError = require('../../core/utils/appError');
const { Op } = require('sequelize'); // Import Op để dùng toán tử IN
const notifService = require('../notifications/notification.service');

// Hàm Helper: Kiểm tra xem User có quyền truy cập khóa học này không (Là học viên đã mua HOẶC là giảng viên)
const checkAccessRight = async (userId, lessonId) => {
    // 1. Lấy dữ liệu không dùng 'as'
    const lesson = await Lesson.findByPk(lessonId, {
        include: [{
            model: Section,
            include: [{ model: Course }]
        }]
    });

    // 2. Phải dùng chữ cái IN HOA (Section, Course) theo mặc định của Sequelize
    if (!lesson || !lesson.Section || !lesson.Section.Course) {
        throw new AppError('Dữ liệu bài học hoặc khóa học không hợp lệ!', 404);
    }

    const courseId = lesson.Section.Course.id;
    const instructorId = lesson.Section.Course.instructorId;

    // 3. Phân quyền
    if (instructorId === userId) return { courseId, isInstructor: true, instructorId };

    const isEnrolled = await Enrollment.findOne({ where: { userId, courseId } });
    if (!isEnrolled) {
        throw new AppError('Bạn phải sở hữu khóa học này mới được tham gia thảo luận!', 403);
    }

    return { courseId, isInstructor: false, instructorId };
};

// 1. Đặt câu hỏi mới
exports.askQuestion = async (userId, lessonId, questionData) => {
    const { courseId, instructorId } = await checkAccessRight(userId, lessonId);

    // Tạo câu hỏi trong Database
    const newQuestion = await LessonQuestion.create({
        lessonId,
        courseId,
        userId,
        title: questionData.title,
        content: questionData.content
    });

    // ==========================================
    // [MỚI] GỬI THÔNG BÁO CHO GIẢNG VIÊN
    // ==========================================
    // Kiểm tra: Chỉ thông báo nếu người đặt câu hỏi KHÔNG PHẢI là giảng viên của khóa đó
    if (userId !== instructorId) {
        try {
            await notifService.pushNotification({
                userId: instructorId,
                title: 'Khóa học của bạn có câu hỏi mới',
                message: `Một học viên vừa đặt câu hỏi: "${questionData.title}". Hãy vào giải đáp để hỗ trợ học viên nhé!`,
                type: 'QnA',
                actionUrl: `/courses/${courseId}/learn?question=${newQuestion.id}`,
                isSendEmail: true // Bắn cả email "ting ting"
            });
        } catch (error) {
            // Bao bọc try-catch để lỗi gửi mail không làm chết API tạo câu hỏi
            console.error('Lỗi gửi thông báo khi có học viên đặt câu hỏi:', error);
        }
    }
    // ==========================================

    return newQuestion;
};

// 2. Lấy danh sách câu hỏi của 1 bài học (Kèm theo các câu trả lời)
exports.getLessonQuestions = async (lessonId) => {
    return await LessonQuestion.findAll({
        where: { lessonId },
        order: [['createdAt', 'DESC']],
        include: [
            { model: User, as: 'author', attributes: ['id', 'fullName', 'role'] },
            {
                model: LessonAnswer,
                as: 'answers',
                include: [{ model: User, as: 'author', attributes: ['id', 'fullName'] }],
                order: [['createdAt', 'ASC']] // Câu trả lời cũ xếp trên
            }
        ]
    });
};

// 3. Trả lời câu hỏi
exports.answerQuestion = async (userId, questionId, content) => {
    const question = await LessonQuestion.findByPk(questionId);
    if (!question) throw new AppError('Câu hỏi không tồn tại!', 404);

    const { isInstructor } = await checkAccessRight(userId, question.lessonId);

    // Gọi thông báo
    if (userId !== question.userId) {
        await notifService.pushNotification({
            userId: question.userId, // ID của học sinh đặt câu hỏi
            title: isInstructor ? 'Giảng viên vừa trả lời cầu hỏi của bạn' : 'Vừa có một bạn học trả lời câu hỏi của bạn',
            message: `Câu hỏi "${question.title}" vừa có phản hồi mới.`,
            type: 'QnA',
            actionUrl: `/courses/${question.courseId}/learn?question=${questionId}`,
            isSendEmail: true // Bắn cả email báo cho học sinh quay lại học
        });
    }

    return await LessonAnswer.create({
        questionId,
        userId,
        content,
        isInstructorResponse: isInstructor // Tự động đánh dấu nếu người trả lời là giảng viên
    });
};

// 4. Giảng viên đánh dấu câu hỏi đã được giải quyết
exports.markAsResolved = async (userId, questionId) => {
    const question = await LessonQuestion.findByPk(questionId);
    if (!question) throw new AppError('Câu hỏi không tồn tại!', 404);

    const { isInstructor } = await checkAccessRight(userId, question.lessonId);

    // Chỉ người đặt câu hỏi HOẶC giảng viên mới được đánh dấu Resolve
    if (question.userId !== userId && !isInstructor) {
        throw new AppError('Bạn không có quyền thực hiện hành động này!', 403);
    }

    question.isResolved = true;
    await question.save();
    return question;
};

// 5. Dashboard Giảng viên: Lấy toàn bộ câu hỏi chưa trả lời của tất cả khóa học
exports.getInstructorUnresolvedQuestions = async (instructorId) => {
    // 1. Tìm tất cả ID khóa học mà giảng viên này sở hữu
    const myCourses = await Course.findAll({
        where: { instructorId: instructorId },
        attributes: ['id']
    });

    const courseIds = myCourses.map(c => c.id);

    // Nếu giảng viên chưa có khóa học nào, trả về mảng rỗng
    if (courseIds.length === 0) return [];

    // 2. Tìm tất cả câu hỏi thuộc các khóa học này và chưa được giải quyết
    const questions = await LessonQuestion.findAll({
        where: {
            courseId: { [Op.in]: courseIds },
            isResolved: false
        },
        include: [
            {
                model: User,
                as: 'author',
                attributes: ['id', 'fullName']
            },
            {
                model: Lesson,
                as: 'lesson',
                attributes: ['id', 'title']
            }
        ],
        order: [['createdAt', 'DESC']] // Câu hỏi mới nhất hiện lên đầu
    });

    return questions;
};

// ==========================================
// NHÓM CẬP NHẬT & XÓA (UPDATE & DELETE)
// ==========================================

// 6. Sửa câu hỏi (Chỉ Tác giả mới được sửa)
exports.updateQuestion = async (userId, questionId, updateData) => {
    const question = await LessonQuestion.findByPk(questionId);
    if (!question) throw new AppError('Câu hỏi không tồn tại!', 404);

    // Kiểm tra quyền sở hữu
    if (question.userId !== userId) {
        throw new AppError('Lỗi bảo mật: Bạn chỉ có quyền sửa câu hỏi do chính mình tạo ra!', 403);
    }

    // Chỉ cho phép cập nhật tiêu đề và nội dung
    question.title = updateData.title || question.title;
    question.content = updateData.content || question.content;
    await question.save();

    return question;
};

// 7. Sửa câu trả lời (Chỉ Tác giả mới được sửa)
exports.updateAnswer = async (userId, answerId, updateData) => {
    const answer = await LessonAnswer.findByPk(answerId);
    if (!answer) throw new AppError('Câu trả lời không tồn tại!', 404);

    if (answer.userId !== userId) {
        throw new AppError('Lỗi bảo mật: Bạn chỉ có quyền sửa câu trả lời do chính mình tạo ra!', 403);
    }

    answer.content = updateData.content || answer.content;
    await answer.save();

    return answer;
};

// 8. Giảng viên tạo Request yêu cầu Kiểm duyệt viên xóa câu hỏi
exports.requestDeleteQuestion = async (userId, questionId, reason) => {
    const question = await LessonQuestion.findByPk(questionId);
    if (!question) throw new AppError('Câu hỏi không tồn tại!', 404);

    // Dùng hàm Helper cũ để check xem người này CÓ PHẢI LÀ GIẢNG VIÊN của khóa này không
    const { isInstructor } = await checkAccessRight(userId, question.lessonId);

    if (!isInstructor) {
        throw new AppError('Chỉ Giảng viên phụ trách khóa học mới có quyền yêu cầu xóa câu hỏi!', 403);
    }

    if (!reason || reason.trim() === '') {
        throw new AppError('Vui lòng cung cấp lý do yêu cầu xóa để Kiểm duyệt viên xem xét!', 400);
    }

    // Đánh dấu cờ yêu cầu xóa
    question.isDeletionRequested = true;
    question.deletionReason = reason;
    await question.save();

    return question;
};

// ==========================================
// NHÓM API DÀNH CHO KIỂM DUYỆT VIÊN (MOD/ADMIN)
// ==========================================

// ==========================================
// NHÓM API DÀNH CHO KIỂM DUYỆT VIÊN (MOD/ADMIN)
// ==========================================

// 9. Lấy danh sách tất cả các câu hỏi đang bị báo cáo yêu cầu xóa
exports.getPendingDeletionQuestions = async () => {
    return await LessonQuestion.findAll({
        where: { isDeletionRequested: true },
        include: [
            { model: User, as: 'author', attributes: ['id', 'fullName'] },
            { model: Lesson, as: 'lesson', attributes: ['id', 'title'] }
        ],
        order: [['updatedAt', 'ASC']] // Ưu tiên xử lý các yêu cầu cũ trước
    });
};

// 10. Xử lý yêu cầu xóa (Chấp nhận hoặc Từ chối)
exports.handleDeleteRequest = async (questionId, action, modNote) => {
    const question = await LessonQuestion.findByPk(questionId);
    if (!question) throw new AppError('Câu hỏi không tồn tại!', 404);

    if (action === 'approve') {
        // CHẤP NHẬN: Xóa vĩnh viễn câu hỏi khỏi Database
        await question.destroy();
        return { message: 'Đã xóa câu hỏi thành công theo yêu cầu.' };
    }

    if (action === 'reject') {
        // TỪ CHỐI: Phải có lý do
        if (!modNote || modNote.trim() === '') {
            throw new AppError('Vui lòng cung cấp lý do từ chối xóa để thông báo cho Giảng viên!', 400);
        }

        // Gỡ cờ yêu cầu và lưu lại lý do từ chối
        question.isDeletionRequested = false;
        question.modNote = modNote;
        // Có thể giữ lại deletionReason cũ để giảng viên đối chiếu nếu cần
        await question.save();

        return { message: 'Đã từ chối yêu cầu xóa.', question };
    }

    throw new AppError('Hành động không hợp lệ! (Chỉ nhận approve hoặc reject)', 400);
};