const AppError = require('../../core/utils/appError');
const Category = require('./category.model');
const Enrollment = require('../store/enrollment.model');
const Course = require('../courses/course.model'); // [MỚI] Import model khóa học
const { Op } = require('sequelize');
const sequelize = require('../../core/database/init.mysql');

// 1. Logic lấy cây danh mục 2 cấp (Đã tích hợp đếm học viên)
exports.getCategoryTree = async () => {
    // Bước 1: Lấy khung cây danh mục (Level 1 và Level 2)
    const categories = await Category.findAll({
        where: {
            parentId: null
        },
        include: [
            {
                model: Category,
                as: 'children',
                attributes: ['id', 'name', 'parentId']
            }
        ],
        attributes: ['id', 'name'],
        order: [['id', 'ASC']]
    });

    if (!categories || categories.length === 0) {
        throw new AppError('Hệ thống hiện chưa có danh mục khóa học nào!', 404);
    }

    // Bước 2: Truy vấn Gom nhóm (GROUP BY) để đếm số học viên của từng danh mục
    // Join từ bảng Course sang bảng Enrollment
    const enrollmentCounts = await Course.findAll({
        attributes: [
            'categoryId',
            // Đếm số lượng userId duy nhất (tránh đếm trùng nếu 1 user mua nhiều khóa trong cùng 1 danh mục)
            [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('enrollments.userId'))), 'studentCount']
        ],
        include: [{
            model: Enrollment,
            as: 'enrollments', // Alias này phải khớp với khai báo trong Course.hasMany
            attributes: [] // Không cần lấy chi tiết, chỉ cần để JOIN
        }],
        group: ['Course.categoryId'],
        raw: true // Trả về JSON thuần để dễ xử lý
    });

    // Bước 3: Tạo một Hash Map (Từ điển) để tra cứu số lượng học viên siêu tốc (O(1))
    const countMap = {};
    enrollmentCounts.forEach(item => {
        countMap[item.categoryId] = parseInt(item.studentCount, 10) || 0;
    });

    // Bước 4: Gắn số lượng học viên vào cây danh mục
    // Chuyển instance của Sequelize thành plain Object để có thể thêm thuộc tính mới
    const plainCategories = categories.map(cat => cat.get({ plain: true }));

    plainCategories.forEach(parent => {
        // Mặc định danh mục cha có 0 học viên, sẽ cộng dồn từ danh mục con lên
        parent.studentCount = 0;

        if (parent.children) {
            parent.children.forEach(child => {
                // Lấy số lượng từ bảng tra cứu (Hash Map), nếu không có thì mặc định là 0
                const count = countMap[child.id] || 0;
                child.studentCount = count;

                // (Tùy chọn) Cộng dồn lên danh mục cha nếu bạn muốn hiển thị tổng ở Level 1
                parent.studentCount += count;
            });
        }
    });

    return plainCategories;
};

// 2. Logic tạo danh mục mới
exports.createCategory = async (categoryData) => { //[cite: 1]
    const existingCategory = await Category.findOne({ where: { name: categoryData.name } });
    if (existingCategory) {
        throw new AppError('Tên danh mục này đã tồn tại trên hệ thống!', 400);
    }

    // Nếu người dùng muốn tạo danh mục con (có truyền parentId)
    if (categoryData.parentId) {
        const parentCategory = await Category.findByPk(categoryData.parentId);

        // Kiểm tra 1: Danh mục cha có tồn tại không?
        if (!parentCategory) {
            throw new AppError('Danh mục gốc không tồn tại!', 404); //[cite: 1, 2]
        }

        // Kiểm tra 2: Chặn tạo danh mục cấp 3 (Ép cấu trúc hệ thống luôn chỉ có 2 cấp)
        // Nếu cái parent mà ta tìm được lại là con của một thằng khác => Lỗi
        if (parentCategory.parentId !== null) {
            throw new AppError('Hệ thống hiện chỉ hỗ trợ danh mục tối đa 2 cấp!', 400); //[cite: 1, 2]
        }
    }

    const newCategory = await Category.create({
        name: categoryData.name,
        parentId: categoryData.parentId || null
    });

    return newCategory;
};

// 3. Logic xóa danh mục
exports.deleteCategory = async (categoryId) => {
    // 1. Tìm danh mục cần xóa
    const category = await Category.findByPk(categoryId);

    if (!category) {
        throw new AppError('Danh mục không tồn tại!', 404);
    }

    // 2. PHÂN NHÁNH LOGIC KIỂM TRA RÀNG BUỘC

    // TRƯỜNG HỢP A: Đây là danh mục gốc (Level 1)
    if (category.parentId === null) {
        // Đếm xem nó có bao nhiêu danh mục con
        const childCount = await Category.count({ where: { parentId: categoryId } });

        if (childCount > 0) {
            throw new AppError(`Không thể xóa! Danh mục gốc này đang chứa ${childCount} danh mục con. Vui lòng xóa hết danh mục con trước.`, 400);
        }
    }
    // TRƯỜNG HỢP B: Đây là danh mục con chi tiết (Level 2)
    else {
        // Đếm xem có khóa học nào đang gán vào danh mục này không
        const courseCount = await Course.count({ where: { categoryId: categoryId } });

        if (courseCount > 0) {
            throw new AppError(`Không thể xóa! Đang có ${courseCount} khóa học thuộc danh mục này. Vui lòng chuyển các khóa học sang danh mục khác trước khi xóa.`, 400);
        }
    }

    // 3. Vượt qua mọi bài kiểm tra thì tiến hành trảm
    await category.destroy();

    return { message: 'Đã xóa danh mục thành công!' };
};

exports.updateCategory = async (categoryId, updateData) => {
    // 1. Tìm danh mục cần sửa
    const category = await Category.findByPk(categoryId);

    if (!category) {
        throw new AppError('Danh mục không tồn tại!', 404);
    }

    // 2. Kiểm tra dữ liệu đầu vào
    if (!updateData.name || updateData.name.trim() === '') {
        throw new AppError('Tên danh mục không được để trống!', 400);
    }

    const duplicateName = await Category.findOne({
        where: {
            name: updateData.name,
            id: { [Op.ne]: categoryId } // "id != categoryId"
        }
    });

    if (duplicateName) {
        throw new AppError('Tên danh mục này đã được sử dụng bởi một danh mục khác!', 400);
    }

    // 3. Tiến hành cập nhật
    category.name = updateData.name;

    // (Tùy chọn) Nếu bạn muốn cho phép chuyển danh mục con sang danh mục cha khác, có thể thêm logic cập nhật parentId ở đây.
    // Tuy nhiên, thường thì người ta chỉ sửa tên để tránh làm hỏng cấu trúc khóa học.

    await category.save();

    return category;
};

exports.moveCourseCategory = async (courseId, newCategoryId) => {
    // 1. Kiểm tra khóa học có tồn tại không
    const course = await Course.findByPk(courseId);
    if (!course) {
        throw new AppError('Không tìm thấy khóa học này!', 404);
    }

    // 2. Kiểm tra danh mục mới có tồn tại không
    const newCategory = await Category.findByPk(newCategoryId);
    if (!newCategory) {
        throw new AppError('Danh mục đích không tồn tại!', 404);
    }

    // 3. RÀNG BUỘC QUAN TRỌNG: Danh mục mới BẮT BUỘC phải là cấp 2
    if (newCategory.parentId === null) {
        throw new AppError('Lỗi cấu trúc: Bạn chỉ có thể chuyển khóa học sang danh mục con chi tiết (Cấp 2), không được chuyển vào danh mục gốc!', 400);
    }

    // 4. Tránh trường hợp chuyển nhầm vào chính danh mục cũ
    if (course.categoryId === newCategoryId) {
        throw new AppError('Khóa học này đã nằm trong danh mục đích rồi!', 400);
    }

    // 5. Thực hiện chuyển đổi
    course.categoryId = newCategoryId;
    await course.save();

    return course;
};