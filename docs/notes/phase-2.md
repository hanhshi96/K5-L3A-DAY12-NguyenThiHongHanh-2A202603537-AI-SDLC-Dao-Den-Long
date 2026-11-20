# Phase 2: đánh giá, nhật ký AI

Spec, giả định và tiêu chí nghiệm thu: [docs/spec/phase-2.md](../spec/phase-2.md). Bằng chứng: [docs/proof/phase-2/](../proof/phase-2/).

## 1. Kết quả theo tiêu chí

| Mục | Kiểm chứng | Kết quả |
|---|---|---|
| Số liệu chuẩn, Contract v1.1 | `tests/contract.test.js` (test "v1.1 and mirrors…") | Đạt |
| Thứ tự 12 bước mỗi tick | toàn bộ test thời điểm (choáng 120, hồi chiêu 180/90, bất tử 90, TTL 480, Gió Lạc 240/120) | Đạt |
| Test Phase 1 (hồi quy) | giữ nguyên các luật không đổi; luật đổi thì sửa test, có ghi chú `// P2:` | Đạt |
| C2 Lướt, nhảy | `tests/phase2.test.js` | Đạt |
| F4 Tạm dừng (headless) | `tests/phase2.test.js` | Đạt |
| Rơi khỏi đảo | `tests/phase2.test.js` | Đạt |
| F2 Bùa Gió | `tests/phase2.test.js` | Đạt |
| C3 Đêm 2/3 (cầu, bục nhảy, tầng, dốc, gió) | `tests/nights.test.js`, ảnh `phase-2-night2.png`, `phase-2-night3.png` | Đạt |
| F1 Gió Lạc | `tests/nights.test.js` (5 test) | Đạt |
| C1 Hiệu năng headless ≤ 30 s mỗi Đêm | `timing.txt`: 205 / 221 / 256 ms | Đạt |
| F3 Chuỗi 3 Đêm, màn hình Bình Minh | code `src/web/main.js` + ảnh menu | Có code và ảnh; **chưa chơi thử trọn 3 Đêm** |
| F4/F5 Menu tạm dừng, cài đặt lưu `localStorage` | code | **Chưa kiểm thử thủ công** |
| F6 Âm thanh (nhạc mỗi Đêm + 10 hiệu ứng) | code (WebAudio) | **Chưa kiểm thử thủ công** |
| F7 HUD đầy đủ | ảnh 3 Đêm | Đạt (theo ảnh) |
| F8 Bảng màu, ánh sáng môi trường 0.15 + 0.55·k | hằng `PALETTE` trong `src/web/main.js` | Đạt (đối chiếu code) |
| ≥ 30 FPS ở 1280×720 | `window.__fps` có trong code | **Chưa đo** trên máy thật |

Có hỏng phase trước không: các test Phase 1 vẫn chạy. Những test bị đổi chỉ là test của các luật mà Ticket-02 đã thay (bảng ở spec §1).

## 2. Nhật ký dùng AI và lỗi của AI

- Quy trình: spec trước → viết lại lõi theo 12 bước → sửa test cũ có lý do → test từng nhóm tính năng → kiểm tra mutation → client 3D → bằng chứng. Người dùng commit sau mỗi bước.
- Lỗi thật trong game do AI viết, phát hiện nhờ test:
  1. Tích phân trọng lực sai làm cú nhảy thấp hơn chuẩn 5% (1.167 so với 1.225 m). Đã đổi sang công thức chính xác.
  2. Sai số dấu phẩy động khiến Mây đáp đất trễ 1 tick (y = 1e-15). Đã thêm sai số cho phép.
  3. Bộ đếm Gió Lạc giảm ở bước 8 thay vì bước 2 nên lệch 1 tick.
  4. `vel` trong snapshot không cập nhật ở tick bục nhảy kích hoạt.
  5. Camera Đêm 3 bắt đầu bên trong tháp chuông (phát hiện qua ảnh chụp).
- Lỗi trong test do AI viết (test sai chứ không phải game sai): nhấn tỏa sáng ở tick sai; quên Bóng Mực làm rơi đom đóm; quên snapshot làm tròn; quên Bùa Gió mặc định nằm trên cầu. Cách phát hiện: đọc output headless thật, không sửa code cho tới khi hiểu nguyên nhân.
- Kiểm tra mutation: cài 11 lỗi, 10 lỗi bị test bắt. Lỗi còn lại không đổi hành vi (hồi chiêu lướt khi có bùa).
- Chỉnh harness: thêm vào AGENTS.md các bài học "đọc output thật trước khi sửa test" và "mọi bộ đếm giảm ở bước 2".
- Token (ước tính): khoảng 150–200k cho Phase 2. Tiết kiệm bằng cách viết lại lõi một lần thay vì vá dần, chạy test theo file, và chỉ đọc chi tiết những test đỏ.

## 3. Cần chỉnh / còn thiếu

- Chơi thử thủ công trọn 3 Đêm, menu tạm dừng, cài đặt, âm thanh; đo FPS. Dự kiến làm đầu Phase 3.
- Giả định G4 (`spawning` 60 tick), G5 (độ cao khi chạm) và G11 (xuất phát Đêm 3) có thể khác bộ test ẩn.
