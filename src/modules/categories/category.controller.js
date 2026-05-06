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