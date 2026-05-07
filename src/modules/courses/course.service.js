const AppError = require('../../core/utils/appError');
const Category = require('../categories/category.model');
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

// HÀM HELPER: BẢO VỆ LỖ HỔNG IDOR (BOLA)
// ==========================================
const checkCourseOwnership = async (courseId, instructorId) => {
    const course = await Course.findByPk(courseId);
    if (!course) throw new AppError('Không tìm thấy khóa học!', 404);

    // So sánh ID của người đang request với ID của chủ khóa học (Ép kiểu string để so sánh an toàn)
    if (course.instructorId.toString() !== instructorId.toString()) {
        throw new AppError('Lỗi bảo mật: Bạn không có quyền can thiệp vào dữ liệu của giảng viên khác!', 403); // HTTP 403: Forbidden
    }
    return course;
};

// 1. Logic tạo khóa học mới
exports.createCourse = async (courseData, instructorId) => {

    // 1. Kiểm tra xem giảng viên đã gửi id danh mục lên chưa
    if (!courseData.categoryId) {
        throw new AppError('Vui lòng chọn danh mục cho khóa học!', 400);
    }

    // 2. Kiểm tra xem danh mục đó có tồn tại trong hệ thống không
    const category = await Category.findByPk(courseData.categoryId);
    if (!category) {
        throw new AppError('Danh mục đã chọn không tồn tại!', 404);
    }

    if (category.parentId === null) {
        throw new AppError('Vui lòng chọn danh mục con chi tiết thay vì danh mục gốc!', 400);
    }

    const newCourse = await Course.create({
        title: courseData.title,
        description: courseData.description,
        price: courseData.price,
        categoryId: courseData.categoryId,
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

exports.updateSection = async (sectionId, instructorId, sectionData) => {
    const section = await Section.findByPk(sectionId);
    if (!section) throw new AppError('Không tìm thấy chương này!', 404);

    // [BẢO MẬT] Kiểm tra quyền
    await checkCourseOwnership(section.courseId, instructorId);

    await section.update({
        title: sectionData.title || section.title,
        orderIndex: sectionData.orderIndex || section.orderIndex
    });
    return section;
};

// Thêm Bài học (ĐÃ CẬP NHẬT: Hỗ trợ upload Video)
exports.addLesson = async (sectionId, instructorId, lessonData, file) => {
    const section = await Section.findByPk(sectionId);
    if (!section) throw new AppError('Không tìm thấy chương này!', 404);

    // [BẢO MẬT] Kiểm tra quyền
    await checkCourseOwnership(section.courseId, instructorId);


    let videoUrl = lessonData.videoUrl; // Giữ lại dự phòng nếu lấy link Youtube ngoài

    // Nếu bài học dạng Video và Giảng viên có đính kèm file MP4
    if (lessonData.lessonType === 'Video' && file) {
        try {
            const result = await cloudinary.uploader.upload(file.path, {
                folder: 'leanova_courses/videos',
                resource_type: 'video' // Ép kiểu để Cloudinary biết đây là video
            });
            videoUrl = result.secure_url;
            fs.unlinkSync(file.path);
        } catch (error) {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            throw new AppError('Lỗi khi tải video lên hệ thống', 500);
        }
    }

    return await Lesson.create({
        title: lessonData.title,
        lessonType: lessonData.lessonType,
        videoUrl: videoUrl,
        articleContent: lessonData.articleContent,
        orderIndex: lessonData.orderIndex,
        sectionId: section.id
    });
};

exports.updateLesson = async (lessonId, instructorId, lessonData, file) => {
    const lesson = await Lesson.findByPk(lessonId);
    if (!lesson) throw new AppError('Không tìm thấy bài học này!', 404);

    // [BẢO MẬT] Phải truy ngược từ Bài học -> Chương -> Khóa học để check quyền
    const section = await Section.findByPk(lesson.sectionId);
    await checkCourseOwnership(section.courseId, instructorId);

    let videoUrl = lesson.videoUrl;

    if (file) {
        try {
            const result = await cloudinary.uploader.upload(file.path, {
                folder: 'leanova_courses/videos',
                resource_type: 'video'
            });
            videoUrl = result.secure_url;
            fs.unlinkSync(file.path);
        } catch (error) {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            throw new AppError('Lỗi khi tải video mới lên hệ thống', 500);
        }
    } else if (lessonData.videoUrl) {
        videoUrl = lessonData.videoUrl;
    }

    await lesson.update({
        title: lessonData.title || lesson.title,
        lessonType: lessonData.lessonType || lesson.lessonType,
        videoUrl: videoUrl,
        articleContent: lessonData.articleContent || lesson.articleContent,
        orderIndex: lessonData.orderIndex || lesson.orderIndex
    });
    return lesson;
};

// [MỚI] Thêm Tài liệu đính kèm (Upload PDF, ZIP)
exports.addAttachment = async (lessonId, instructorId, attachmentData, file) => {
    const lesson = await Lesson.findByPk(lessonId);
    if (!lesson) throw new AppError('Không tìm thấy bài học này!', 404);

    // [BẢO MẬT]
    const section = await Section.findByPk(lesson.sectionId);
    await checkCourseOwnership(section.courseId, instructorId);

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

exports.updateAttachment = async (attachmentId, instructorId, attachmentData, file) => {
    const attachment = await Attachment.findByPk(attachmentId);
    if (!attachment) throw new AppError('Không tìm thấy tài liệu này!', 404);

    // [BẢO MẬT] Truy ngược: Attachment -> Lesson -> Section -> Course
    const lesson = await Lesson.findByPk(attachment.lessonId);
    const section = await Section.findByPk(lesson.sectionId);
    await checkCourseOwnership(section.courseId, instructorId);

    let fileUrl = attachment.fileUrl;
    let fileName = attachmentData.fileName || attachment.fileName;

    if (file) {
        try {
            const result = await cloudinary.uploader.upload(file.path, {
                folder: 'leanova_courses/attachments',
                resource_type: 'auto'
            });
            fileUrl = result.secure_url;
            fileName = attachmentData.fileName || file.originalname;
            fs.unlinkSync(file.path);
        } catch (error) {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            throw new AppError('Lỗi khi cập nhật tài liệu mới', 500);
        }
    }

    await attachment.update({ fileName, fileUrl });
    return attachment;
};

// [MỚI] Thêm Bài Quiz vào Chương
exports.addQuiz = async (sectionId, instructorId, quizData) => {
    const section = await Section.findByPk(sectionId);
    if (!section) throw new AppError('Không tìm thấy chương này!', 404);

    // [BẢO MẬT]
    await checkCourseOwnership(section.courseId, instructorId);

    const newQuiz = await Quiz.create({
        title: quizData.title,
        passingScorePercent: quizData.passingScorePercent,
        timeLimitMinutes: quizData.timeLimitMinutes,
        sectionId: section.id
    });
    return newQuiz;
};