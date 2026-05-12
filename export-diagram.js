const fs = require('fs');
const sequelizeErd = require('sequelize-erd');
const sequelize = require('./core/database/init.mysql'); // Đường dẫn tới file init DB của bạn

// Phải require tất cả các Model vào đây để Sequelize nạp cấu trúc
require('./src/models/courses/course.model');
require('./src/models/users/user.model');
require('./src/models/courses/review.model');
// ... require thêm các model khác

async function generateDiagram() {
    try {
        // Tự động vẽ và xuất ra mã SVG
        const svg = await sequelizeErd({ source: sequelize });
        fs.writeFileSync('./leanova-diagram.svg', svg);
        console.log('✅ Đã xuất biểu đồ thành công ra file leanova-diagram.svg');
        process.exit(0);
    } catch (error) {
        console.error('❌ Lỗi xuất biểu đồ:', error);
    }
}

generateDiagram();