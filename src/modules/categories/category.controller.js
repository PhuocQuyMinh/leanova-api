const categoryService = require('./category.service');
const catchAsync = require('../../core/utils/catchAsync');

exports.getAllCategories = catchAsync(async (req, res, next) => {
    const categoryTree = await categoryService.getCategoryTree();

    res.status(200).json({
        status: 'success',
        results: categoryTree.length,
        data: { categories: categoryTree }
    });
});

exports.createCategory = catchAsync(async (req, res, next) => {
    const newCategory = await categoryService.createCategory(req.body);

    res.status(201).json({
        status: 'success',
        message: 'Tạo danh mục thành công!',
        data: { category: newCategory }
    });
});

// API Xóa danh mục
exports.deleteCategory = catchAsync(async (req, res, next) => {
    const { id } = req.params; // Lấy ID từ tham số URL

    const result = await categoryService.deleteCategory(id);

    res.status(200).json({
        status: 'success',
        message: result.message
    });
});

// API Sửa tên danh mục
exports.updateCategory = catchAsync(async (req, res, next) => {
    const { id } = req.params; // Lấy ID từ tham số URL

    // Gọi service cập nhật với body gửi lên (chứa trường name)
    const updatedCategory = await categoryService.updateCategory(id, req.body);

    res.status(200).json({
        status: 'success',
        message: 'Đã cập nhật danh mục thành công!',
        data: {
            category: updatedCategory
        }
    });
});