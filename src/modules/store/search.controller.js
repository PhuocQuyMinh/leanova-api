const searchService = require('./search.service');
const catchAsync = require('../../core/utils/catchAsync');

exports.search = catchAsync(async (req, res, next) => {
    // Truyền toàn bộ object req.query (chứa keyword, minPrice, limit,...) xuống service
    const result = await searchService.searchCourses(req.query);

    res.status(200).json({
        status: 'success',
        data: result
    });
});