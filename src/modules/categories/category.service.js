const AppError = require('../../core/utils/appError');
const Category = require('./category.model');

// 1. Logic lấy cây danh mục 2 cấp
exports.getCategoryTree = async () => {
    const categories = await Category.findAll({
        where: {
            parentId: null // Chỉ lấy các danh mục gốc
        },
        include: [
            {
                model: Category,
                as: 'children',
                attributes: ['id', 'name', 'parentId']
            }
        ],
        attributes: ['id', 'name'],
        order: [['id', 'ASC']] // Sắp xếp cho đẹp
    });

    // Nếu không có dữ liệu, ném lỗi theo đúng chuẩn hệ thống
    if (!categories || categories.length === 0) {
        throw new AppError('Hệ thống hiện chưa có danh mục khóa học nào!', 404); //[cite: 1, 2]
    }

    return categories;
};

// 2. Logic tạo danh mục mới
exports.createCategory = async (categoryData) => { //[cite: 1]
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