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

Website công khai vẫn báo Supabase auth/repository/storage; QA2–QA7 còn mock và `authoringReady=false` tại lúc kiểm tra. Code mới không tự thay đổi environment hay dữ liệu production.

Kết nối Vercel trả 403 cho scope `jft-simiulator`; cần kết nối lại tài khoản có quyền trong scope này. Supabase báo dự án `jft-simulator` ACTIVE_HEALTHY, nhưng `execute_sql` trả lỗi xác thực postgres. Vì vậy chưa xác nhận được 60 đề đã thực sự được phát hành và chưa chạy live smoke bằng tài khoản production.

Sau khi khôi phục quyền truy cập:

1. Kiểm tra environment hiện tại, đặt sáu biến `<PREFIX>_PROVIDER=azure-openai` theo `.env.production.example`, xác nhận credential Azure và redeploy.
2. Gọi preview release bằng admin để xác nhận 3.000 câu, các ID v3 còn thiếu/xung đột. Nếu xung đột, điều tra snapshot; không ghi đè.
3. Chạy `npm run release:production` với credential server hợp lệ để bổ sung snapshot còn thiếu. Giữ nguyên phiên bản cũ và lịch sử.
4. Chạy `npm run smoke:production` bằng token server, yêu cầu đủ 60 đề và luồng thi thực tế PASS.
5. Chạy mẫu QA thật, kiểm tra evidence của từng judge; chỉ chạy hàng loạt sau khi mẫu được nghiệm thu. Nghiệm thu ngôn ngữ/audio và email recovery thật vẫn cần bằng chứng riêng.
