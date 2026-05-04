const AppError = require('../../core/utils/appError');

const Course = require('./course.model');
const Section = require('./section.model');
const Lesson = require('./lesson.model');
const Attachment = require('./attachment.model');
const Quiz = require('./quiz.model');

const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// 1. Logic tạo khóa học mới
exports.createCourse = async (courseData, instructorId) => {
    const newCourse = await Course.create({
        title: courseData.title,
        description: courseData.description,
        price: courseData.price,
        instructorId: instructorId // Lấy ID của người đang đăng nhập gắn vào khóa học
    });

    return newCourse;
};

// 2. Logic lấy danh sách khóa học do chính giảng viên đó tạo
exports.getInstructorCourses = async (instructorId) => {
    const courses = await Course.findAll({
        where: { instructorId: instructorId },
        order: [['createdAt', 'DESC']] // Sắp xếp khóa học mới nhất lên đầu
    });

    return courses;
};

// [CRUD] Cập nhật khóa học (Bao gồm upload ảnh bìa)
exports.updateCourse = async (courseId, instructorId, updateData, file) => {
    const course = await Course.findOne({ where: { id: courseId, instructorId } });
    if (!course) throw new AppError('Khóa học không tồn tại hoặc bạn không có quyền sửa!', 404);

    if (file) {
        try {
            // Tự tay đẩy file từ ổ cứng lên Cloudinary
            const result = await cloudinary.uploader.upload(file.path, {
                folder: 'leanova_courses',
                resource_type: 'auto' // Tự nhận diện là ảnh
            });

            updateData.coverImage = result.secure_url; // Lấy link HTTPS xịn xò

            // Dọn dẹp rác: Xóa file tạm trên ổ cứng server
            fs.unlinkSync(file.path);
        } catch (error) {
            // Nếu có lỗi lúc up lên mây, cũng phải xóa file tạm đi
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            throw new AppError('Lỗi khi đẩy ảnh lên Cloudinary', 500);
        }
    }

    // Nếu khóa học đang bị "Từ chối" mà Giảng viên vào sửa lại (khắc phục lỗi)
    // Hệ thống tự động chuyển trạng thái thành "Chờ duyệt" và xóa lời chê cũ đi
    if (course.status === 'Rejected') {
        updateData.status = 'Pending';
        updateData.rejectMessage = null;
    }

    await course.update(updateData);
    return course;
};

// [Curriculum] Thêm Chương mới vào Khóa học
exports.addSection = async (courseId, instructorId, sectionData) => {
    // Đảm bảo chỉ chủ sở hữu khóa học mới được thêm chương
    const course = await Course.findOne({ where: { id: courseId, instructorId } });
    if (!course) throw new AppError('Không tìm thấy khóa học hợp lệ!', 404);

    const newSection = await Section.create({
        title: sectionData.title,
        orderIndex: sectionData.orderIndex,
        courseId: course.id
    });
    return newSection;
};

// [MỚI] Thêm Bài học (Chỉ chứa Video hoặc Text)
exports.addLesson = async (sectionId, lessonData) => {
    const section = await Section.findByPk(sectionId);
    if (!section) throw new AppError('Không tìm thấy chương này!', 404);

    const newLesson = await Lesson.create({
        title: lessonData.title,
        lessonType: lessonData.lessonType, // 'Video' hoặc 'Article'
        videoUrl: lessonData.videoUrl,
        articleContent: lessonData.articleContent,
        orderIndex: lessonData.orderIndex,
        sectionId: section.id
    });
    return newLesson;
};

// [MỚI] Thêm Tài liệu đính kèm (Upload PDF, ZIP)
exports.addAttachment = async (lessonId, attachmentData, file) => {
    const lesson = await Lesson.findByPk(lessonId);
    if (!lesson) throw new AppError('Không tìm thấy bài học này!', 404);
    if (!file) throw new AppError('Vui lòng chọn file để đính kèm!', 400);

    let fileUrl = '';
    try {
        const result = await cloudinary.uploader.upload(file.path, {
            folder: 'leanova_courses/attachments',
            resource_type: 'auto' // Tự nhận diện file RAW (PDF, Docx)
        });

        fileUrl = result.secure_url;
        fs.unlinkSync(file.path); // Xóa file tạm
    } catch (error) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        throw new AppError('Lỗi khi đẩy tài liệu lên Cloudinary', 500);
    }

    const newAttachment = await Attachment.create({
        fileName: attachmentData.fileName || file.originalname,
        fileUrl: fileUrl,
        lessonId: lesson.id
    });

    return newAttachment;
};

// [MỚI] Thêm Bài Quiz vào Chương
exports.addQuiz = async (sectionId, quizData) => {
    const section = await Section.findByPk(sectionId);
    if (!section) throw new AppError('Không tìm thấy chương này!', 404);

    const newQuiz = await Quiz.create({
        title: quizData.title,
        passingScorePercent: quizData.passingScorePercent,
        timeLimitMinutes: quizData.timeLimitMinutes,
        sectionId: section.id
    });
    return newQuiz;
};