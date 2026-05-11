'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Danh sách các danh mục lấy từ ảnh của bạn
    const categories = [
      { id: 6, name: 'Lập trình' },
      { id: 7, name: 'Cơ khí' },
      { id: 8, name: 'Âm thanh' },
      { id: 9, name: 'Điện nước' },
      { id: 10, name: 'Thanh nhạc (Hát)' },
      { id: 11, name: 'Piano' },
      { id: 12, name: 'Trống (Drum)' },
      { id: 13, name: 'Hội họa & Thiết kế' },
      { id: 14, name: 'Digital Marketing' },
      { id: 15, name: 'Tài chính - Kế toán' },
      { id: 16, name: 'Khởi nghiệp' },
      { id: 17, name: 'Tiếng Anh giao tiếp' },
      { id: 18, name: 'IELTS / TOEIC' },
      { id: 19, name: 'Tiếng Nhật' },
      { id: 20, name: 'Giao tiếp & Thuyết trình' },
      { id: 21, name: 'Quản lý thời gian' }
    ];

    // 2. Mảng ID giảng viên theo yêu cầu
    const instructorIds = [4, 6, 7, 10, 11, 12, 13, 14, 15];

    // 3. Mảng URL ảnh từ Cloudinary (Bạn hãy thay bằng các link ảnh thực tế trong folder của bạn)
    const cloudinaryImages = [
      'https://res.cloudinary.com/dsvuxujy4/image/upload/q_auto/f_auto/v1778487206/dam-bao-tinh-nhat-quan-650x478_tornpt.jpg',
      'https://res.cloudinary.com/dsvuxujy4/image/upload/q_auto/f_auto/v1778487206/1600w-XxwYF0h94Ow_ffhn8k.webp',
      'https://res.cloudinary.com/dsvuxujy4/image/upload/q_auto/f_auto/v1778487206/hq720_e47or8.jpg',
      'https://res.cloudinary.com/dsvuxujy4/image/upload/q_auto/f_auto/v1778487206/thumbnail-la-gi-nhung-meo-thiet-ke-thumbnail-thu-hut-nguoi-xem-p590-2_cnatdn.webp',
      'https://res.cloudinary.com/dsvuxujy4/image/upload/q_auto/f_auto/v1778487206/anh-thumbnail-blog-2025-11-05t170220771_baulvv.png',
      "https://res.cloudinary.com/dsvuxujy4/image/upload/q_auto/f_auto/v1778487205/youtube-video-thumbnail-web-banner-template-business_475351-141_t11l37.avif",
      "https://res.cloudinary.com/dsvuxujy4/image/upload/q_auto/f_auto/v1778487205/1_bmdxy2.png",
      "https://res.cloudinary.com/dsvuxujy4/image/upload/q_auto/f_auto/v1778487205/Yeu-to-con-nguoi-trong-anh-thumbnail_ni6jgx.png",
      "https://res.cloudinary.com/dsvuxujy4/image/upload/q_auto/f_auto/v1778487205/Tao-anh-thumbnail-thu-hut_wkymvh.png",
      "https://res.cloudinary.com/dsvuxujy4/image/upload/q_auto/f_auto/v1778487204/khoa-hoc-phan-tich-du-lieu-tai-chinh-financial-data-analysis.png_d0g00q.webp",
      "https://res.cloudinary.com/dsvuxujy4/image/upload/q_auto/f_auto/v1778487204/khoa-hoc-lightroom.thumbnail_re9uty.webp",
      "https://res.cloudinary.com/dsvuxujy4/image/upload/q_auto/f_auto/v1778487204/images_4_ebsxx0.jpg",
      "https://res.cloudinary.com/dsvuxujy4/image/upload/q_auto/f_auto/v1778487204/images_qpkdwl.jpg",
      "https://res.cloudinary.com/dsvuxujy4/image/upload/q_auto/f_auto/v1778487204/image15-2_w7z323.png",
      "https://res.cloudinary.com/dsvuxujy4/image/upload/q_auto/f_auto/v1778487204/image7_vdvufh.png",
      "https://res.cloudinary.com/dsvuxujy4/image/upload/q_auto/f_auto/v1778487203/images_1_leyqxu.jpg",
      "https://res.cloudinary.com/dsvuxujy4/image/upload/q_auto/f_auto/v1778487203/images_2_bq3pmy.jpg"
      // Thêm nhiều URL khác vào đây để tăng độ đa dạng...
    ];

    // Helper functions để random dữ liệu
    const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const getRandomPrice = () => {
      // 20% cơ hội là khóa học miễn phí (giá = 0)
      if (Math.random() < 0.2) return 0;
      // Các mức giá từ 199k đến 2.500k
      const prices = [199000, 299000, 399000, 499000, 599000, 899000, 1200000, 1500000, 2500000];
      return getRandomItem(prices);
    };

    // Các mẫu tiêu đề để xào nấu cho khóa học có vẻ thực tế hơn
    const titlePrefixes = ['Tuyệt chiêu', 'Làm chủ', 'Khóa học', 'Trọn bộ', 'Bí quyết', 'Thực chiến', 'Nhập môn'];
    const titleSuffixes = ['từ A-Z', 'cho người mới bắt đầu', 'đỉnh cao', 'thực tế 100%', 'trong 30 ngày', 'chuyên sâu', 'cơ bản đến nâng cao'];

    const coursesToInsert = [];

    // 4. Tạo dữ liệu 30 khóa học cho mỗi danh mục
    for (const category of categories) {
      for (let i = 1; i <= 30; i++) {
        // Sinh tên khóa học ngẫu nhiên nhưng vẫn chứa tên danh mục
        const prefix = getRandomItem(titlePrefixes);
        const suffix = getRandomItem(titleSuffixes);
        // Thêm một số ngẫu nhiên hoặc i để đảm bảo không bị trùng lặp hoàn toàn
        const title = `${prefix} ${category.name} ${suffix} - Phần ${i}`;

        coursesToInsert.push({
          title: title,
          description: `<p>Chào mừng bạn đến với khóa học <strong>${title}</strong>. Khóa học này được thiết kế đặc biệt để cung cấp cho bạn những kiến thức thực tế nhất về lĩnh vực ${category.name}.</p><p>Học xong áp dụng được ngay!</p>`,
          price: getRandomPrice(),
          status: 'Published', // Theo yêu cầu, luôn là published
          rejectMessage: null,
          coverImage: getRandomItem(cloudinaryImages), // Lấy random ảnh từ mảng Cloudinary
          averageRating: 0, // Mặc định
          reviewCount: 0,   // Mặc định
          instructorId: getRandomItem(instructorIds), // Lấy random 1 mã GV từ danh sách
          categoryId: category.id,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    // 5. Insert toàn bộ vào database (Bulk Insert)
    await queryInterface.bulkInsert('courses', coursesToInsert, {});
  },

  async down(queryInterface, Sequelize) {
    // Lệnh để xóa toàn bộ dữ liệu nếu cần rollback
    await queryInterface.bulkDelete('courses', null, {});
  }
};