# JFT Simulator — cập nhật hoàn thiện 04/10/2026

## Thay đổi

- QA2–QA7 có adapter Azure OpenAI trực tiếp, dùng các prompt/validator và chính sách duyệt hiện có. Không cần xây thêm HTTP adapter bên ngoài.
- Oracle suy đáp án chỉ từ dữ liệu người học nhìn thấy, không nhận đáp án công bố hay giải thích.
- Cấu hình Azure dùng credential chung hoặc override riêng từng judge. Credential HTTP không bị diễn giải thành credential Azure.
- `/api/v1/system` chặn authoring readiness khi chuyên biệt chọn Azure/HTTP nhưng thiếu cấu hình cần thiết. Readiness vẫn chỉ là kiểm tra cấu hình.
- Smoke production yêu cầu đủ 60 snapshot v3 (20/mức), đúng ID/title/mức/số câu/thời gian/phần thi. Chỉ có 3 đề hoặc còn v2 sẽ thất bại.
- Smoke audio xử lý được cả URL tương đối và URL storage tuyệt đối.
- README, mẫu environment và màn hình phát hành được cập nhật theo 60 đề.

## Kiểm chứng

- TypeScript: PASS.
- Unit/integration: 273/273 PASS, gồm transport cho 6 adapter, cách ly credential, lỗi provider/output, readiness thiếu key và catalog thiếu/sai đề.
- Production build: PASS.
- Kết quả browser E2E và CI: xem run gắn với PR/commit của thay đổi này.
- Test adapter dùng Azure response giả lập; chưa phải bằng chứng nghiệm thu chất lượng model thật.

## Production và việc còn chặn

Ngày 04/10/2026, production đã nhận đủ sáu biến `<PREFIX>_PROVIDER=azure-openai` và được redeploy. `/api/v1/system` báo `ready=true`, `authoringReady=true`, sáu specialized QA đều là `azure-openai`. Đây chỉ là readiness cấu hình.

Admin release preview xác nhận 3.000 câu và 60 đề v3, không có snapshot xung đột. Lượt phát hành đầu bị `FUNCTION_INVOCATION_TIMEOUT` sau khi ghi 22 đề. PR #18 sửa đường ghi: bỏ qua câu không đổi, kiểm tra xung đột trước khi ghi, tiếp tục phần đề thiếu theo nhóm giới hạn và tăng `maxDuration` lên 300 giây. CI QA/E2E đều PASS. Lượt phát hành tiếp theo tạo 38 đề mới, giữ 22 snapshot cũ. Sau khi tải lại trang quản trị, trạng thái `ĐÃ PHÁT HÀNH`, 60/60 snapshot và 3.000/3.000 câu được xác nhận từ production. Phiên bản v2 trước đây vẫn tồn tại.

Một lần sinh thử một câu bằng xưởng AI thất bại. Job đã lưu báo Azure OpenAI `401`: khóa subscription không hợp lệ hoặc endpoint không khớp resource. Vì vậy chưa có bằng chứng QA2–QA7 chạy thành công bằng model thật. Không chạy hàng loạt, không duyệt câu sinh thử thất bại. Cần sửa cặp endpoint/API key Azure trong môi trường Vercel production bằng thao tác bảo mật, redeploy, rồi sinh một mẫu và kiểm tra evidence của từng judge.

Chưa chạy `npm run smoke:production` vì không có production smoke token; phiên quản trị không thể thay cho vai trò học viên để kiểm thử toàn bộ luồng thi. Nghiệm thu âm thanh/ngôn ngữ và email recovery thật cũng còn cần bằng chứng riêng. Vercel plugin trả 403 trên scope `jft-simiulator`; thao tác được hoàn thành qua phiên trình duyệt đã đăng nhập. Supabase SQL connector vẫn báo lỗi xác thực postgres.
