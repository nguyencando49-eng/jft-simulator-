# Kiểm tra và hoàn thiện JFT — 27/09/2026

## Phạm vi và bằng chứng gốc

- Repo: `nguyencando49-eng/jft-simulator-`, bắt đầu từ commit `2b8b025`.
- Website: https://jft-simulator.vercel.app.
- Supabase: dự án `jft-simulator`, truy vấn chỉ đọc xác nhận 1.000 câu được duyệt ở mỗi mức A1 / A2.1 / A2.2; 1.320 câu A1 cũ đã lưu trữ.
- Ba đề production v2 đã được phát hành, mỗi đề 48 câu. Các phiên bản preview/legacy vẫn tồn tại để giữ lịch sử.
- Runtime công khai báo `repository=supabase`, `authentication=supabase`, `ready=true`, nhưng `authoringReady=false`: QA2–QA7 vẫn là mock/deterministic.
- Bộ test trước sửa: 239/239 đạt. Dependency production: npm audit không phát hiện lỗ hổng. PR bảo mật cũ không phản ánh phiên bản Next.js hiện tại (15.5.25).
- Báo cáo `PRODUCT_COMPLETION_AUDIT.md` ngày 16/08 là tài liệu lịch sử; không dùng tỷ lệ hoặc tồn kho cũ để mô tả hiện tại.

## Lỗi được xử lý trong đợt này

| Lỗi đã xác nhận | Hành vi sau sửa | Kiểm chứng |
|---|---|---|
| Autosave thất bại nhưng vẫn chuyển câu, mất khả năng sửa câu Nghe trước đó | Khóa thao tác khi lưu/chưa lưu thành công, có nút thử lưu lại đúng thay đổi; cảnh báo khi đóng trang có thay đổi chưa lưu | Browser E2E mất kết nối và tải lại |
| Lỗi lưu ở hạn giờ ngăn nộp bài | Khi hết giờ, nộp các đáp án đã được máy chủ xác nhận; không mở lại bài để sửa muộn | E2E hết giờ với autosave lỗi |
| Đóng trang trước hạn rồi mở lại không xem được kết quả | Mở lại bài hết giờ hoặc lịch sử sẽ hoàn tất bài và hiển thị kết quả | E2E cho cả trang thi và lịch sử |
| API cho phép nhảy qua các phần hoặc sửa phần đã kết thúc | Chỉ được đi sang phần kế tiếp từ câu cuối; cấm sửa phần đã đóng; giữ mặc định Nghe tuần tự cho snapshot cũ | Unit và E2E gọi API trực tiếp |
| Bản ghi lúc nộp/hết hạn có thể ghi đè đáp án vừa lưu | Chuyển trạng thái chỉ cập nhật trạng thái; đọc lại để chấm điểm; submitted là trạng thái cuối | Regression memory và Supabase adapter |
| Đề preview bị ẩn ở UI nhưng vẫn tạo phiên qua ID trực tiếp | API tạo phiên dùng cùng điều kiện hiển thị đề production | API regression |
| Đăng nhập làm mất tham số đề/phiên trong link | Giữ đường dẫn và query được yêu cầu, chặn chuyển hướng ra ngoài site | Unit và browser E2E |
| Gửi khôi phục mật khẩu báo thành công dù upstream lỗi | Kiểm tra HTTP status, kiểm tra kiểu input, xử lý network/timeout và không lộ chi tiết upstream | Test API với provider giả lập |
| Production thiếu cấu hình có thể rơi về memory; cờ dev mâu thuẫn với auth | Production từ chối repository không cấu hình; cờ dev không bật lại memory/auth giả | Runtime regression |

Không thay đổi ngân hàng câu hỏi, snapshot đề đã phát hành hay dữ liệu học viên trong đợt này.

## Kiểm chứng bản sửa

- TypeScript: đạt.
- Unit/integration: 260 test đạt (42 file).
- Next.js production build: đạt.
- Browser E2E: 12/12 đạt, gồm đăng ký, toàn bộ luồng thi/Nghe/nộp, 6 ca hồi quy mới và 2 luồng admin. GitHub Actions: xem trạng thái PR/CI đi kèm; chưa coi là đạt trước khi chạy xong.
- Local browser dùng Chromium đóng gói riêng do môi trường không tải được bản mặc định; không đổi dependency ứng dụng.
- Smoke production đã cập nhật để kiểm tra việc chặn nhảy phần và đi tuần tự đúng quy tắc.

## Phần còn cần hoàn thiện và giới hạn xác minh

1. **Cấu hình QA2–QA7 thật trên Vercel.** Kết nối hiện tại trả 403 với scope `jft-simiulator`; cần kết nối lại đúng workspace trước khi sửa/kiểm tra environment. Không tự đổi mock thành PASS hoặc nới điều kiện duyệt.
2. **Đa dạng đề.** Ngân hàng 3.000 câu hiện được đóng thành 3 đề, mỗi mức 1 đề. Chưa đạt mục tiêu cũ 20 đề/mức. Việc mở rộng cần quy tắc độ phủ, kiểm soát trùng/lộ câu và nghiệm thu nội dung; không nhân bản đề chỉ để đủ số lượng.
3. **Nghiệm thu ngôn ngữ và audio.** Test cấu trúc/độ đa dạng không thay cho người có chuyên môn nghe và duyệt toàn bộ 525 audio cùng 3.000 câu. Chưa có bằng chứng đầy đủ cho việc này.
4. **Xác minh tài khoản thật.** Chưa thực hiện gửi email khôi phục thật hay kiểm thử SMTP/redirect allowlist bằng tài khoản production; test lỗi API dùng provider giả lập và E2E dùng auth phát triển.
5. **Điều hướng đồng thời từ nhiều tab.** Quy tắc phần thi được kiểm tra tại API; RPC hiện tại vẫn chỉ merge tiến độ. Nếu cần bảo đảm trước hai yêu cầu điều hướng đồng thời, bổ sung kiểm tra quy tắc ngay trong transaction/RPC và bộ test tích hợp Postgres.
6. **Readiness và release gate.** `ready=true` chỉ phản ánh cấu hình đã có; không chứng minh hoàn tất dữ liệu hoặc QA nội dung. GitHub trả `protected=false` cho main tại thời điểm khảo sát. Cần thiết lập required checks bằng quyền quản trị để bảo đảm Vercel production không chạy trước QA Gate.

Báo cáo không khẳng định toàn bộ sản phẩm đã hoàn thiện hoặc tương đương kỳ thi JFT chính thức.
