const Course = require('../courses/course.model');
const Section = require('../courses/section.model');
const Lesson = require('../courses/lesson.model');
const Attachment = require('../courses/attachment.model');
const Quiz = require('../courses/quiz.model');
const User = require('../users/user.model');
const CartItem = require('./cart_item.model');
const Enrollment = require('./enrollment.model');
const Order = require('./order.model');
const sequelize = require('../../core/database/init.mysql');
const AppError = require('../../core/utils/appError');
const LessonProgress = require('./lesson_progress.model');
const QuizQuestion = require('../courses/quiz_question.model');
const QuizAttempt = require('./quiz_attempt.model');
const crypto = require('crypto');
const moment = require('moment');
const qs = require('qs');
const OrderItem = require('../finance/order_item.model');
const InstructorSetting = require('../finance/instructor_setting.model');
const SystemSetting = require('../finance/system_setting.model');
const sendEmail = require('../../core/utils/email.util');
const notifService = require('../notifications/notification.service');
const Favorite = require('../favorites/favorite.model'); // Import model mới
const { Op } = require('sequelize');

// 1. Cửa hàng: Lấy danh sách khóa học đang bán
exports.getPublishedCourses = async () => {
    return await Course.findAll({
        where: { status: 'Published' },
        attributes: ['id', 'title', 'price', 'coverImage', 'averageRating', 'reviewCount',], // Chỉ lấy các cột cần thiết cho giao diện thẻ (card)
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
                    attributes: ['id', 'title', 'lessonType', 'durationString', 'isPreviewable', 'orderIndex', 'videoUrl', 'articleContent'],
                    include: [
                        { model: Attachment, as: 'attachments' },
                        { model: Quiz, as: 'quizzes' }
                    ]
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

    // Thêm số lượng học viên đã đăng ký thành công
    courseData.enrollmentCount = await Enrollment.count({ where: { courseId } });

    courseData.sections.forEach(section => {
        section.lessons.forEach(lesson => {
            if (!lesson.isPreviewable) {
                // Nếu không cho xem thử -> Xóa URL video và nội dung bài đọc trước khi gửi về Client
                delete lesson.videoUrl;
                delete lesson.articleContent;
                delete lesson.attachments; // Ẩn luôn tài liệu đính kèm
                delete lesson.quizzes; // Ẩn luôn bài kiểm tra
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

// [MỚI] 3.1. Giỏ hàng: Xóa một khóa học khỏi giỏ
exports.removeFromCart = async (userId, courseId) => {
    // 1. Tìm CartItem dựa trên userId và courseId
    const cartItem = await CartItem.findOne({ where: { userId, courseId } });

    // 2. Báo lỗi nếu không tìm thấy (user cố tình truyền sai ID hoặc đã xóa rồi)
    if (!cartItem) throw new AppError('Khóa học này không tồn tại trong giỏ hàng của bạn!', 404);

    // 3. Thực hiện xóa khỏi DB
    await cartItem.destroy();

    return { message: 'Đã xóa khóa học khỏi giỏ hàng.' };
};

// 4. Giỏ hàng: Xem giỏ hàng
exports.getMyCart = async (userId) => {
    return await CartItem.findAll({
        where: { userId },
        include: [{ model: Course, attributes: ['id', 'title', 'price', 'coverImage'] }]
    });
};

// 5. Nâng cấp: Tạo Đơn hàng & Sinh link thanh toán VNPay (đã có tính giá triền trong link thanh toán)
exports.checkout = async (userId, ipAddr) => {
    // 1. Tính tổng tiền giỏ hàng
    const cartItems = await CartItem.findAll({
        where: { userId },
        include: [{ model: Course, attributes: ['price'] }]
    });

    if (cartItems.length === 0) throw new AppError('Giỏ hàng trống!', 400);

    let totalAmount = 0;
    cartItems.forEach(item => totalAmount += item.Course.price);

    // 2. Tạo mã đơn hàng duy nhất (TxnRef)
    const date = new Date();

    // Mã đơn hàng
    const txnRef = moment(date).format('DDHHmmss');

    // 3. Lưu đơn hàng vào DB với trạng thái Pending
    const order = await Order.create({
        userId,
        amount: totalAmount,
        txnRef,
        status: 'Pending'
    });

    // 4. Xây dựng tham số gửi sang VNPay
    const tmnCode = process.env.VNP_TMN_CODE;
    const secretKey = process.env.VNP_HASH_SECRET;
    const vnpUrl = process.env.VNP_URL;
    const returnUrl = process.env.VNP_RETURN_URL;
    const createDate = moment(date).format('YYYYMMDDHHmmss');

    let vnp_Params = {
        'vnp_Version': '2.1.0',
        'vnp_Command': 'pay',
        'vnp_TmnCode': tmnCode,
        'vnp_Locale': 'vn',
        'vnp_CurrCode': 'VND',
        'vnp_TxnRef': txnRef,
        'vnp_OrderInfo': `Thanh toan don hang ${txnRef}`,
        'vnp_OrderType': 'other',
        'vnp_Amount': totalAmount * 100, // VNPay yêu cầu nhân 100
        'vnp_ReturnUrl': returnUrl,
        'vnp_IpAddr': ipAddr,
        'vnp_CreateDate': createDate
    };

    // 5. Sắp xếp tham số và Tạo chữ ký bảo mật (Checksum)
    vnp_Params = sortObject(vnp_Params); // Gọi hàm phụ trợ bên dưới
    const signData = qs.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(new Buffer.from(signData, 'utf-8')).digest("hex");
    vnp_Params['vnp_SecureHash'] = signed;

    // 6. Trả về URL để Frontend chuyển hướng người dùng sang VNPay
    const paymentUrl = vnpUrl + '?' + qs.stringify(vnp_Params, { encode: false });

    return { paymentUrl, orderId: order.id };
};

// 5.1 Xử lý kết quả VNPay trả về
exports.vnpayReturn = async (vnp_Params) => {
    const secureHash = vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    const secretKey = process.env.VNP_HASH_SECRET;
    const signData = qs.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(new Buffer.from(signData, 'utf-8')).digest("hex");

    // Kiểm tra chữ ký có chuẩn không (Chống Hacker fake URL)
    if (secureHash === signed) {
        const txnRef = vnp_Params['vnp_TxnRef'];
        const responseCode = vnp_Params['vnp_ResponseCode'];

        const order = await Order.findOne({ where: { txnRef } });
        if (!order) throw new AppError('Đơn hàng không tồn tại!', 404);

        if (responseCode === '00') {
            // GIAO DỊCH THÀNH CÔNG (Tiền đã vào túi)
            // 1. Cập nhật trạng thái Order
            order.status = 'Success';
            await order.save();

            // 1. Lấy phí mặc định từ DB trước
            const globalSetting = await SystemSetting.findByPk('DEFAULT_COMMISSION_RATE');
            const defaultRate = globalSetting ? parseFloat(globalSetting.value) : 0.7; // Fallback về 0.7 nếu DB trống

            // 2. Lấy giỏ hàng KÈM THEO thông tin Khóa học (giá, ID giảng viên)
            const cartItems = await CartItem.findAll({
                where: { userId: order.userId },
                include: [{ model: Course, attributes: ['id', 'title', 'price', 'instructorId'] }]
            });

            // Lấy danh sách ID của các giảng viên có khóa học trong giỏ hàng
            const instructorIds = [...new Set(cartItems.map(item => item.Course.instructorId))];

            // Truy vấn cài đặt hoa hồng của các giảng viên này
            const settings = await InstructorSetting.findAll({
                where: { userId: instructorIds }
            });

            // Tạo 1 map { instructorId: commissionRate } để tra cứu nhanh
            const commissionMap = {};
            settings.forEach(setting => {
                commissionMap[setting.userId] = setting.commissionRate;
            });

            // 3. Chuẩn bị mảng dữ liệu để Insert vào 2 bảng (Enrollments và OrderItems)
            const enrollmentsData = [];
            const orderItemsData = [];

            cartItems.forEach(item => {
                const course = item.Course;

                // Mảng Enrollments (Cấp quyền học)
                enrollmentsData.push({
                    userId: order.userId,
                    courseId: course.id
                });

                // Mảng OrderItems (Chia tiền)
                // Nếu giảng viên chưa có cài đặt, lấy mặc định của nền tảng
                const commissionRate = commissionMap[course.instructorId] || defaultRate;
                const instructorEarnings = Math.round(course.price * commissionRate);

                orderItemsData.push({
                    orderId: order.id,
                    courseId: course.id,
                    instructorId: course.instructorId,
                    priceAtPurchase: course.price,
                    commissionRate: commissionRate,
                    instructorEarnings: instructorEarnings
                });
            });

            // 4. Lưu đồng loạt vào Database (Bulk Create)
            await Enrollment.bulkCreate(enrollmentsData);
            await OrderItem.bulkCreate(orderItemsData); // <-- Lưu lịch sử tài chính cho Giảng viên

            // 5. Xóa giỏ hàng
            await CartItem.destroy({ where: { userId: order.userId } });

            // ==================================================
            // [MỚI] BẮN EMAIL THÔNG BÁO CHO HỌC VIÊN
            // ==================================================
            try {
                // Lấy thông tin user (đã có model User được import sẵn ở đầu file)
                const user = await User.findByPk(order.userId, { attributes: ['fullName', 'email'] });

                if (user && user.email) {
                    // Lấy danh sách tên khóa học để hiện đẹp trong mail
                    const courseListHTML = cartItems.map(item => {
                        const courseName = item.Course?.title || 'Khóa học không tên';
                        const coursePrice = `${item.Course?.price.toLocaleString('vi-VN')} VNĐ` || 'Free';

                        return `<li><strong>${courseName}: ${coursePrice} </strong></li>`;
                    }).join('');

                    await sendEmail({
                        email: user.email,
                        subject: `Xác nhận thanh toán thành công đơn hàng #${order.txnRef} - Leanova`,
                        html: `
                            <div style="font-family: sans-serif; line-height: 1.6;">
                                <h2 style="color: #4CAF50;">Thanh toán thành công!</h2>
                                <p>Xin chào <strong>${user.fullName}</strong>,</p>
                                <p>Cảm ơn bạn đã mua sắm tại Leanova. Đơn hàng <strong>#${order.txnRef}</strong> của bạn đã được thanh toán thành công.</p>
                                
                                <p>Các khóa học bạn vừa sở hữu bao gồm:</p>
                                <ul>
                                    ${courseListHTML}
                                </ul>
                                
                                <p>Tổng số tiền thanh toán: <strong>${order.amount.toLocaleString('vi-VN')} VNĐ</strong></p>
                                
                                <p>Bạn có thể đăng nhập vào hệ thống và truy cập mục <strong>"Không gian học tập"</strong> để bắt đầu học ngay bây giờ.</p>
                                
                                <br>
                                <p>Trân trọng,<br><strong>Đội ngũ Leanova</strong></p>
                            </div>
                        `
                    });
                }
            } catch (error) {
                // Dùng try...catch để nếu gửi mail lỗi (VD: sai mật khẩu mail), 
                // luồng code vẫn chạy tiếp để báo thành công cho VNPay, tránh việc user bị trừ tiền nhưng web báo lỗi.
                console.error('Lỗi gửi email xác nhận thanh toán:', error);
            }

            // ==================================================
            // [MỚI] BẮN THÔNG BÁO CHO TỪNG GIẢNG VIÊN CÓ KHÓA HỌC ĐƯỢC MUA
            // ==================================================
            try {
                // 1. Gom nhóm khóa học theo từng Giảng viên
                // Mục tiêu: gom từ [{courseId: 1, instructorId: A}, {courseId: 2, instructorId: A}, {courseId: 3, instructorId: B}]
                // Thành: { A: [course1, course2], B: [course3] }
                const instructorCoursesMap = {};

                orderItemsData.forEach(item => { // orderItemsData đã chứa sẵn commissionRate và instructorEarnings từ trên
                    if (!instructorCoursesMap[item.instructorId]) {
                        instructorCoursesMap[item.instructorId] = [];
                    }
                    // Tìm tên khóa học từ cartItems gốc
                    const courseDetail = cartItems.find(cItem => cItem.Course.id === item.courseId);

                    instructorCoursesMap[item.instructorId].push({
                        courseName: courseDetail.Course.title,
                        price: item.priceAtPurchase,
                        commissionRate: item.commissionRate,
                        earnings: item.instructorEarnings
                    });
                });

                // 2. Lặp qua từng Giảng viên để gửi thông báo
                for (const [instructorId, purchasedCourses] of Object.entries(instructorCoursesMap)) {

                    let totalEarningsThisOrder = 0;
                    let courseListHtml = '';

                    // Tính tổng thu nhập của ông Giảng viên này trong cái giỏ hàng này
                    // và nối chuỗi HTML danh sách khóa học
                    purchasedCourses.forEach(course => {
                        totalEarningsThisOrder += course.earnings;
                        courseListHtml += `
                            <li>
                                <strong>${course.courseName}</strong><br>
                                Giá bán: ${course.price.toLocaleString('vi-VN')} VNĐ<br>
                                Tỉ lệ hoa hồng: ${(course.commissionRate * 100)}%<br>
                                Thu nhập của bạn: <span style="color: #4CAF50; font-weight: bold;">+${course.earnings.toLocaleString('vi-VN')} VNĐ</span>
                            </li><br>
                        `;
                    });

                    // 3. Gửi Notification (Cả in-app và qua Email)
                    // (Lưu ý: notifService.pushNotification sẽ tự động query bảng User để lấy Email của giảng viên)
                    await notifService.pushNotification({
                        userId: instructorId,
                        title: 'Ting ting! Bạn vừa có lượt đăng ký khóa học mới',
                        message: `Khóa học của bạn vừa được mua. Bạn nhận được ${totalEarningsThisOrder.toLocaleString('vi-VN')} VNĐ vào tài khoản doanh thu.`,
                        type: 'Payment', // Loại thông báo liên quan đến tiền bạc
                        actionUrl: '/instructor/revenue', // Dẫn họ về trang xem doanh thu
                        isSendEmail: true,
                        customHtml: courseListHtml
                        // Nếu bạn muốn truyền thêm HTML tự tạo vào email, bạn sẽ cần nâng cấp hàm pushNotification 
                        // bên file notification.service.js để nhận thêm biến customHtml. 
                        // (Hoặc tạm thời message dạng text như trên là hệ thống cũng đã gửi mail được rồi)
                    });
                }

            } catch (instructorNotifError) {
                // Tương tự, lỗi thông báo không được phép làm sập giao dịch
                console.error('Lỗi khi gửi thông báo ting ting cho Giảng viên:', instructorNotifError);
            }

            return { code: '00', message: 'Thanh toán thành công! Khóa học đã được mở.' };
        } else {
            // GIAO DỊCH THẤT BẠI
            order.status = 'Failed';
            await order.save();
            return { code: '97', message: 'Thanh toán thất bại hoặc bị hủy!' };
        }
    } else {
        throw new AppError('Chữ ký bảo mật không hợp lệ!', 400);
    }
};

// --- HÀM PHỤ TRỢ (Bắt buộc của VNPay để chuẩn hóa chuỗi) ---
function sortObject(obj) {
    let sorted = {};
    let str = [];
    let key;
    for (key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            str.push(encodeURIComponent(key));
        }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
        sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
}

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
                        include: [{ model: Attachment, as: 'attachments' }, { model: Quiz, as: 'quizzes' }] // Full tài liệu đính kèm
                    }
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

// 1. Toggle Favorite (Thêm hoặc Xóa khỏi mục yêu thích)
exports.toggleFavorite = async (userId, courseId) => {
    // Kiểm tra khóa học có tồn tại và đang bán không
    const course = await Course.findOne({ where: { id: courseId, status: 'Published' } });
    if (!course) throw new AppError('Khóa học không tồn tại hoặc chưa được xuất bản!', 404);

    const existingFavorite = await Favorite.findOne({ where: { userId, courseId } });

    if (existingFavorite) {
        // Nếu đã yêu thích rồi -> Xóa đi
        await existingFavorite.destroy();
        return { isFavorite: false, message: 'Đã xóa khỏi mục yêu thích' };
    } else {
        // Nếu chưa -> Thêm mới
        await Favorite.create({ userId, courseId });
        return { isFavorite: true, message: 'Đã thêm vào mục yêu thích' };
    }
};

// 2. Lấy danh sách khóa học yêu thích của tôi
exports.getMyFavorites = async (userId) => {
    return await Favorite.findAll({
        where: { userId },
        include: [{
            model: Course,
            attributes: ['id', 'title', 'price', 'coverImage', 'averageRating'],
            include: [{ model: User, as: 'instructor', attributes: ['fullName'] }]
        }],
        order: [['createdAt', 'DESC']]
    });
};

// API Không gian học tập: Lấy chi tiết khóa học & Tiến độ (Auto-focus)
exports.getLearningSpaceCourseDetail = async (userId, courseId) => {
    // 1. Kiểm tra quyền truy cập (Học viên đã mua khóa học chưa?)
    const enrollment = await Enrollment.findOne({ where: { userId, courseId } });
    if (!enrollment) throw new AppError('Bạn chưa sở hữu khóa học này! Vui lòng mua để truy cập.', 403);

    // 2. Kéo toàn bộ cấu trúc khóa học (Giống getCourseDetailForMod)
    const course = await Course.findByPk(courseId, {
        include: [
            { model: User, as: 'instructor', attributes: ['id', 'fullName', 'avatarUrl'] },
            {
                model: Section, as: 'sections',
                include: [{
                    model: Lesson, as: 'lessons',
                    include: [
                        { model: Attachment, as: 'attachments' },
                        {
                            model: Quiz, as: 'quizzes',
                            include: [{ model: QuizQuestion, as: 'questions' }]
                        }
                    ]
                }]
            }
        ],
        order: [
            [{ model: Section, as: 'sections' }, 'orderIndex', 'ASC'],
            [{ model: Section, as: 'sections' }, { model: Lesson, as: 'lessons' }, 'orderIndex', 'ASC']
        ]
    });

    if (!course) throw new AppError('Không tìm thấy khóa học này!', 404);

    // 3. Gom ID của tất cả các bài học lại để truy vấn tiến độ một lần cho nhẹ DB
    const lessonIds = [];
    course.sections.forEach(section => {
        section.lessons.forEach(lesson => {
            lessonIds.push(lesson.id);
        });
    });

    // 4. Lấy lịch sử học tập của user đối với các bài học trên
    const progressRecords = await LessonProgress.findAll({
        where: {
            userId: userId,
            lessonId: { [Op.in]: lessonIds }
        }
    });

    // Tạo một Map (Key-Value) để tra cứu trạng thái hoàn thành cực nhanh
    // VD: { 101: true, 102: true, 103: false }
    const progressMap = {};
    progressRecords.forEach(record => {
        progressMap[record.lessonId] = record.isCompleted;
    });

    // 5. THUẬT TOÁN TÌM BÀI HỌC DỞ DANG (AUTO-FOCUS)
    // Chuyển kết quả Sequelize thành JSON thuần để dễ chèn thêm dữ liệu
    const courseData = course.toJSON();

    let focusLessonId = null; // ID bài học cần focus
    let isFocusFound = false; // Cờ đánh dấu đã tìm thấy chưa

    courseData.sections.forEach(section => {
        section.lessons.forEach(lesson => {
            // Tra cứu xem bài này học xong chưa (nếu chưa có record thì mặc định là false)
            const isCompleted = progressMap[lesson.id] || false;

            // Chèn thẳng trạng thái hoàn thành vào từng bài học để Frontend dễ vẽ nút tích xanh (Checkmark)
            lesson.isCompleted = isCompleted;

            // Nếu đây là bài ĐẦU TIÊN chưa hoàn thành -> Đặt làm Focus Lesson
            if (!isCompleted && !isFocusFound) {
                focusLessonId = lesson.id;
                isFocusFound = true;
            }
        });
    });

    // Fallback: Nếu học viên đã học xong 100% khóa học, focus lại vào bài học đầu tiên (hoặc để null tùy bạn)
    if (!focusLessonId && lessonIds.length > 0) {
        focusLessonId = lessonIds[0];
    }

    // Đính kèm các tham số tổng quan ra ngoài cùng
    courseData.focusLessonId = focusLessonId;
    courseData.overallProgressPercent = enrollment.progressPercent; // % hoàn thành tổng thể

    return courseData;
};

// [MỚI] Lấy top 20 khóa học có nhiều lượt đăng ký nhất
exports.getTopPopularCourses = async () => {
    const popularCourses = await Enrollment.findAll({
        attributes: [
            'courseId',
            // Đếm số lượng học viên cho mỗi khóa học
            [sequelize.fn('COUNT', sequelize.col('courseId')), 'enrollmentCount']
        ],
        include: [
            {
                model: Course,
                where: { status: 'Published' }, // Chỉ lấy các khóa học đang bán
                attributes: ['id', 'title', 'price', 'coverImage', 'averageRating'],
                include: [{ model: User, as: 'instructor', attributes: ['fullName'] }]
            }
        ],
        group: ['courseId'], // Nhóm theo từng khóa học
        order: [[sequelize.literal('enrollmentCount'), 'DESC']], // Sắp xếp theo số lượng đăng ký giảm dần
        limit: 20, // Lấy top 20
        subQuery: false // Bắt buộc khi dùng limit kèm aggregation trong Sequelize
    });

    return popularCourses;
};