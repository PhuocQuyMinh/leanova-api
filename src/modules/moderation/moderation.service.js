const Course = require('../courses/course.model');
const Section = require('../courses/section.model');
const Lesson = require('../courses/lesson.model');
const User = require('../users/user.model');
const InstructorRequest = require('./instructor_request.model');
const sequelize = require('../../core/database/init.mysql');
const AppError = require('../../core/utils/appError');
const Attachment = require('../courses/attachment.model');
const Quiz = require('../courses/quiz.model');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const notifService = require('../notifications/notification.service');

// Cấu hình Cloudinary (Đảm bảo bạn đã có các biến này trong file .env)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ==========================================
// LUỒNG 1: DUYỆT KHÓA HỌC
// ==========================================

// 1.1 Lấy danh sách khóa học chờ duyệt (Kèm theo thông tin Giảng viên & Số lượng chương)
exports.getPendingCourses = async () => {
    return await Course.findAll({
        where: { status: 'Pending' },
        include: [
            { model: User, as: 'instructor', attributes: ['id', 'fullName', 'email'] },
            { model: Section, as: 'sections', attributes: ['id', 'title'] }
        ],
        order: [['createdAt', 'ASC']] // Ai nộp trước duyệt trước (FIFO)
    });
};

// 1.2 Quyết định Duyệt hoặc Từ chối khóa học
exports.reviewCourse = async (courseId, action, rejectMessage = '') => {
    const course = await Course.findByPk(courseId);
    if (!course) throw new AppError('Không tìm thấy khóa học!', 404);
    if (course.status !== 'Pending') throw new AppError('Khóa học này đã được xử lý rồi!', 400);

    if (action === 'Approve') {
        course.status = 'Published';
        course.rejectMessage = null; // Xóa lỗi cũ nếu có
    } else if (action === 'Reject') {
        if (!rejectMessage) throw new AppError('Bắt buộc phải nhập lý do từ chối!', 400);
        course.status = 'Rejected';
        course.rejectMessage = rejectMessage;
    } else {
        throw new AppError('Hành động không hợp lệ (Chỉ Approve hoặc Reject)', 400);
    }

    await course.save();
    return course;
};

// 1.1.5 Xem chi tiết toàn bộ nội dung khóa học (Dành cho Mod duyệt bài)
exports.getCourseDetailForMod = async (courseId) => {
    const course = await Course.findByPk(courseId, {
        include: [
            {
                model: User,
                as: 'instructor',
                attributes: ['id', 'fullName', 'email']
            },
            {
                model: Section,
                as: 'sections',
                include: [
                    {
                        model: Lesson,
                        as: 'lessons',
                        include:
                            [
                                {
                                    model: Attachment,
                                    as: 'attachments'
                                },
                                {
                                    model: Quiz,
                                    as: 'quizzes'
                                }
                            ] // Lấy cả tài liệu đính kèm
                    }

                ]
            }
        ],
        order: [
            [{ model: Section, as: 'sections' }, 'orderIndex', 'ASC'],
            [{ model: Section, as: 'sections' }, { model: Lesson, as: 'lessons' }, 'orderIndex', 'ASC']
        ]
    });

    if (!course) throw new AppError('Không tìm thấy khóa học này!', 404);

    return course;
};

// ==========================================
// LUỒNG 2: DUYỆT GIẢNG VIÊN (SỬ DỤNG TRANSACTION)
// ==========================================

// 2.1 Học viên nộp đơn đăng ký (ĐÃ CẬP NHẬT LUỒNG UPLOAD)
exports.createInstructorRequest = async (userId, requestData, file) => {
    // 1. Kiểm tra xem có đơn nào đang Pending không
    const existingRequest = await InstructorRequest.findOne({ where: { userId, status: 'Pending' } });
    if (existingRequest) throw new AppError('Bạn đang có một đơn chờ duyệt rồi!', 400);

    // 2. Kiểm tra file đính kèm
    if (!file) throw new AppError('Vui lòng đính kèm file chứng chỉ hoặc CV!', 400);

    let certificateUrl = '';

    // 3. Xử lý Upload an toàn 2 bước giống addAttachment
    try {
        const result = await cloudinary.uploader.upload(file.path, {
            folder: 'leanova_moderation/certificates',
            resource_type: 'auto' // Quan trọng: Để 'auto' thì Cloudinary mới nhận được file PDF
        });

        certificateUrl = result.secure_url;

        // Dọn rác: Xóa file tạm
        fs.unlinkSync(file.path);
    } catch (error) {
        // Có lỗi xảy ra cũng phải xóa file tạm để không đầy ổ cứng server
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        throw new AppError('Lỗi khi đẩy file chứng chỉ lên Cloudinary', 500);
    }

    // 4. Lưu vào Database
    return await InstructorRequest.create({
        userId,
        bio: requestData.bio,
        experience: requestData.experience,
        portfolioUrl: requestData.portfolioUrl,
        certificateUrl: certificateUrl
    });
};

exports.getInstructorRequestDetail = async (requestId) => {
    const request = await InstructorRequest.findByPk(requestId, {
        include: [{
            model: User,
            as: 'applicant',
            attributes: ['id', 'fullName', 'email', 'avatarUrl']
        }]
    });

    if (!request) throw new AppError('Không tìm thấy đơn đăng ký này!', 404);

    return request;
};

// 2.2 Mod lấy danh sách đơn chờ duyệt
exports.getPendingInstructorRequests = async () => {
    return await InstructorRequest.findAll({
        where: { status: 'Pending' },
        include: [{ model: User, as: 'applicant', attributes: ['id', 'fullName', 'email'] }],
        order: [['createdAt', 'ASC']]
    });
};

// 2.3 Mod xử lý đơn (Kỹ thuật Transaction)
exports.reviewInstructorRequest = async (requestId, action, rejectReason = '') => {
    // Khởi tạo Transaction
    const t = await sequelize.transaction();

    try {
        const request = await InstructorRequest.findByPk(requestId, { transaction: t });
        if (!request) throw new AppError('Không tìm thấy đơn đăng ký!', 404);
        if (request.status !== 'Pending') throw new AppError('Đơn này đã được xử lý!', 400);

        if (action === 'Reject') {
            if (!rejectReason) throw new AppError('Bắt buộc phải nhập lý do từ chối!', 400);
            request.status = 'Rejected';
            request.rejectReason = rejectReason;
            // Write 'reject status' to db
            await request.save({ transaction: t });
        }

        else if (action === 'Approve') {
            // 1. Đổi trạng thái đơn
            request.status = 'Approved';

            // Write 'approved status' to db            
            await request.save({ transaction: t });

            // 2. Nâng cấp Role cho User
            const user = await User.findByPk(request.userId, { transaction: t });
            user.role = 'Instructor';
            await user.save({ transaction: t });
        }

        // Nếu mọi thứ chạy êm đẹp, Commit lưu vào DB
        await t.commit();

        // ==========================================
        // GỬI THÔNG BÁO (SAU KHI COMMIT THÀNH CÔNG)
        // ==========================================
        try {
            if (action === 'Approve') {
                await notifService.pushNotification({
                    userId: request.userId,
                    title: 'Chúc mừng! Bạn đã trở thành giảng viên tại Leanova',
                    message: 'Hồ sơ của bạn đã được phê duyệt. Bây giờ bạn có thể bắt đầu tạo khóa học và chia sẻ kiến thức của mình.',
                    type: 'Account',
                    actionUrl: '/instructor/dashboard',
                    isSendEmail: true
                });
            } else if (action === 'Reject') {
                await notifService.pushNotification({
                    userId: request.userId,
                    title: 'Cập nhật về Đơn đăng ký Giảng viên của bạn',
                    // Nhúng trực tiếp lý do từ chối vào tin nhắn để học viên biết đường sửa
                    message: `Rất tiếc, đơn đăng ký trở thành giảng viên của bạn chưa được phê duyệt lúc này. Lý do từ ban kiểm duyệt: "${rejectReason}". Bạn có thể cập nhật lại hồ sơ và nộp lại nhé!`,
                    type: 'Account',
                    actionUrl: '/apply-instructor', // Dẫn họ quay lại trang điền form
                    isSendEmail: true
                });
            }
        } catch (notifError) {
            // Lỗi gửi mail không được làm sập luồng duyệt đơn
            console.error(`Lỗi gửi thông báo khi xử lý đơn (Action: ${action}):`, notifError);
        }

        return request;

    } catch (error) {
        // Nếu có bất kỳ lỗi gì ở trên, Rollback toàn bộ, coi như chưa có chuyện gì xảy ra
        await t.rollback();
        throw error;
    }
};