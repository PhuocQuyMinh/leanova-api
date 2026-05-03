// Hàm này sẽ bọc mọi Controller. Nó loại bỏ việc bạn phải viết try...catch ở hàng chục file khác nhau.
const catchAsync = fn => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};

module.exports = catchAsync;