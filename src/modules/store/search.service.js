const { Op } = require('sequelize');
const Course = require('../courses/course.model');
const User = require('../users/user.model');
const Category = require('../categories/category.model');
const Enrollment = require('../store/enrollment.model');

exports.searchCourses = async (queryData) => {
    // 1. Lấy các tham số từ query string, gán giá trị mặc định nếu không có
    const {
        keyword,
        categoryId,
        minPrice,
        maxPrice,
        minRating,
        sortBy = 'createdAt', // Mặc định sắp xếp theo ngày tạo
        order = 'DESC',       // Mặc định mới nhất lên đầu
        page = 1,
        limit = 10
    } = queryData;

    // 2. KHỞI TẠO ĐIỀU KIỆN LỌC (Chỉ tìm khóa học đã xuất bản)
    const whereClause = { status: 'Published' };

    // Tìm theo từ khóa (LIKE %keyword%)
    if (keyword) {
        whereClause.title = {
            [Op.like]: `%${keyword}%`
        };
    }

    // Lọc theo danh mục
    if (categoryId) {
        whereClause.categoryId = categoryId;
    }

    // Lọc theo khoảng giá (Price range)
    if (minPrice || maxPrice) {
        whereClause.price = {};
        if (minPrice) whereClause.price[Op.gte] = parseFloat(minPrice);
        if (maxPrice) whereClause.price[Op.lte] = parseFloat(maxPrice);
    }

    // Lọc theo số sao đánh giá tối thiểu (VD: >= 4.0)
    if (minRating) {
        whereClause.averageRating = {
            [Op.gte]: parseFloat(minRating)
        };
    }

    // 3. XỬ LÝ SẮP XẾP (SORTING)
    // Danh sách các cột cho phép sắp xếp (Tránh lỗi SQL Injection khi user truyền bậy)
    const allowedSortFields = ['price', 'createdAt', 'averageRating', 'reviewCount'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // 4. XỬ LÝ PHÂN TRANG (PAGINATION)
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // 5. THỰC THI TRUY VẤN VÀ ĐẾM TỔNG SỐ (findAndCountAll)
    const { count, rows } = await Course.findAndCountAll({
        where: whereClause,
        attributes: ['id', 'title', 'price', 'coverImage', 'averageRating', 'reviewCount', 'createdAt'],
        include: [
            { model: User, as: 'instructor', attributes: ['id', 'fullName'] },
            { model: Category, as: 'category', attributes: ['id', 'name'] }
        ],
        order: [[sortField, sortOrder]],
        limit: parseInt(limit),
        offset: offset
    });

    // 6. TRẢ VỀ DỮ LIỆU KÈM META DATA PHÂN TRANG
    return {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        courses: rows
    };
};

// [MỚI] API tìm kiếm và lọc khóa học đã đăng ký
exports.searchMyEnrollments = async (userId, queryData) => {
    const {
        keyword,
        instructorId,
        minProgress,
        maxProgress,
        sortBy = 'createdAt', // Mặc định sắp xếp theo ngày đăng ký (mới nhất)
        order = 'DESC',
        page = 1,
        limit = 10
    } = queryData;

    // 1. Điều kiện lọc trên bảng Enrollment (Bắt buộc phải của user này)
    const enrollmentWhere = { userId: userId };

    // Lọc theo tiến độ học tập (progressPercent)
    if (minProgress !== undefined || maxProgress !== undefined) {
        enrollmentWhere.progressPercent = {};
        if (minProgress !== undefined) enrollmentWhere.progressPercent[Op.gte] = parseInt(minProgress);
        if (maxProgress !== undefined) enrollmentWhere.progressPercent[Op.lte] = parseInt(maxProgress);
    }

    // 2. Điều kiện lọc trên bảng Course (Tên khóa học & Giảng viên)
    const courseWhere = {};
    if (keyword) {
        courseWhere.title = { [Op.like]: `%${keyword}%` };
    }
    if (instructorId) {
        courseWhere.instructorId = instructorId;
    }

    // 3. Xử lý sắp xếp
    const allowedSortFields = ['createdAt', 'progressPercent', 'updatedAt'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // 4. Xử lý phân trang
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // 5. Thực thi truy vấn
    const { count, rows } = await Enrollment.findAndCountAll({
        where: enrollmentWhere,
        include: [
            {
                model: Course,
                // Chỉ apply where nếu có điều kiện (keyword hoặc instructorId), ngược lại để undefined để lấy hết
                where: Object.keys(courseWhere).length > 0 ? courseWhere : undefined,
                attributes: ['id', 'title', 'coverImage'],
                include: [
                    { model: User, as: 'instructor', attributes: ['id', 'fullName'] }
                ]
            }
        ],
        order: [[sortField, sortOrder]],
        limit: parseInt(limit),
        offset: offset,
        distinct: true // Bắt buộc phải có khi dùng limit với include để đếm 'count' cho chuẩn xác
    });

    // 6. Trả về kết quả
    return {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        enrollments: rows
    };
};