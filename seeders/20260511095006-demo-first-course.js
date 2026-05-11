'use strict';

require('dotenv').config();

// Import toàn bộ Models (Sửa lại đường dẫn cho đúng với dự án của bạn)
const Course = require('../src/modules/courses/course.model');
const Section = require('../src/modules/courses/section.model');
const Lesson = require('../src/modules/courses/lesson.model');
const Attachment = require('../src/modules/courses/attachment.model');
const Quiz = require('../src/modules/courses/quiz.model');
const QuizQuestion = require('../src/modules/courses/quiz_question.model');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // URL Demo video công khai của Cloudinary (chắc chắn chạy được)
    const demoVideoUrl = "https://res.cloudinary.com/demo/video/upload/v1689793108/samples/elephants.mp4";
    const demoPdfUrl = "https://res.cloudinary.com/demo/image/upload/v1689793098/samples/cloudinary-icon.png"; // Dùng tạm link ảnh/tài liệu

    // Hàm phụ trợ tạo 5 bài học cho mỗi chương kèm theo Quiz
    const generateLessons = (sectionIndex, sectionName) => {
      const lessons = [];
      for (let i = 1; i <= 5; i++) {
        const isLastLesson = i === 5; // Bài cuối cùng sẽ có Quiz

        let lesson = {
          title: `Bài ${i}: Nội dung chi tiết phần ${i} của ${sectionName}`,
          lessonType: 'Video',
          videoUrl: demoVideoUrl,
          durationString: `1${i}:30`, // VD: 11:30
          isPreviewable: sectionIndex === 1 && i <= 2, // Chỉ cho học thử 2 bài đầu của chương 1
          orderIndex: i,

          // Đính kèm 1 file cho mỗi bài học
          attachments: [
            {
              fileName: `Tai-lieu-bai-${i}.pdf`,
              fileUrl: demoPdfUrl,
              fileSizeString: '2.5 MB'
            }
          ]
        };

        // Nếu là bài học cuối cùng của chương, nhét thêm 1 bài Quiz vào
        if (isLastLesson) {
          lesson.quizzes = [
            {
              title: `Bài kiểm tra cuối chương: ${sectionName}`,
              description: 'Hoàn thành bài kiểm tra này để mở khóa chương tiếp theo.',
              passingScorePercent: 80,
              timeLimitMinutes: 15,
              orderIndex: 1,
              questions: [
                {
                  questionText: 'Trong Node.js, hàm nào được dùng để đọc file bất đồng bộ?',
                  choices: [
                    { id: 1, text: 'fs.readFileSync', isCorrect: false },
                    { id: 2, text: 'fs.readFile', isCorrect: true },
                    { id: 3, text: 'fs.read', isCorrect: false },
                    { id: 4, text: 'fs.open', isCorrect: false }
                  ],
                  explanation: 'Hàm fs.readFile() không chặn Event Loop và thực thi bất đồng bộ.'
                },
                {
                  questionText: 'NPM là viết tắt của từ gì?',
                  choices: [
                    { id: 1, text: 'Node Package Manager', isCorrect: true },
                    { id: 2, text: 'Node Project Module', isCorrect: false },
                    { id: 3, text: 'New Package Manager', isCorrect: false }
                  ],
                  explanation: 'NPM là công cụ quản lý các thư viện/package của môi trường Node.js.'
                }
              ]
            }
          ];
        }

        lessons.push(lesson);
      }
      return lessons;
    };

    try {
      // SỬ DỤNG MODEL CREATE VỚI INCLUDE (Deep Insert)
      // Lưu ý: Đảm bảo trong DB của bạn đã có User (id=1) và Category (id=1)
      await Course.create({
        title: 'Lập trình Node.js & Express RESTful API từ cơ bản đến nâng cao',
        description: 'Khóa học toàn diện giúp bạn làm chủ Backend bằng Javascript. Cung cấp kiến thức thực chiến với kiến trúc MVC, bảo mật JWT, và thao tác Database với Sequelize.',
        price: 599000,
        status: 'Published',
        coverImage: 'https://res.cloudinary.com/demo/image/upload/v1689793098/samples/ecommerce/accessories-bag.jpg',
        averageRating: 4.8,
        reviewCount: 15,
        instructorId: 1, // ID của giảng viên (Bắt buộc phải có trong bảng Users)
        categoryId: 1,   // ID của danh mục (Bắt buộc phải có trong bảng Categories)

        // TẠO LUÔN 4 CHƯƠNG VÀ CÁC BÀI HỌC BÊN TRONG
        sections: [
          {
            title: 'Chương 1: Khởi đầu với Node.js và Môi trường',
            orderIndex: 1,
            lessons: generateLessons(1, 'Khởi đầu với Node.js')
          },
          {
            title: 'Chương 2: Express.js Cơ bản và Routing',
            orderIndex: 2,
            lessons: generateLessons(2, 'Express.js Cơ bản')
          },
          {
            title: 'Chương 3: Làm việc với Database (MySQL & Sequelize)',
            orderIndex: 3,
            lessons: generateLessons(3, 'Database MySQL')
          },
          {
            title: 'Chương 4: Xác thực JWT & Phân quyền',
            orderIndex: 4,
            lessons: generateLessons(4, 'Xác thực JWT')
          }
        ]
      }, {
        // LIỆT KÊ CÁC MỐI QUAN HỆ ĐỂ SEQUELIZE TỰ ĐỘNG TẠO SÂU (DEEP CREATE)
        include: [
          {
            model: Section,
            as: 'sections',
            include: [
              {
                model: Lesson,
                as: 'lessons',
                include: [
                  { model: Attachment, as: 'attachments' },
                  {
                    model: Quiz,
                    as: 'quizzes',
                    include: [{ model: QuizQuestion, as: 'questions' }]
                  }
                ]
              }
            ]
          }
        ]
      });

      console.log('✅ Seeding thành công 1 khóa học hoàn chỉnh (4 chương, 20 bài học, tài liệu & Quiz)!');
    } catch (error) {
      console.error('❌ Lỗi khi seeding:', error);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Xóa khóa học có tên tương ứng (Sequelize cascade sẽ tự động xóa các mục con nếu đã cấu hình onDelete: 'CASCADE')
    await queryInterface.bulkDelete('courses', {
      title: 'Lập trình Node.js & Express RESTful API từ cơ bản đến nâng cao'
    }, {});
  }
};