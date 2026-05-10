const { Op } = require('sequelize');
const Course = require('../courses/course.model');
const User = require('../users/user.model');
const Category = require('../categories/category.model');

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