# Phase 3: đánh giá, nhật ký AI

ADR: [docs/adr/0001](../adr/0001-lantern-fuel-and-dawn-win.md) · Changelog: [CHANGELOG.md](../../CHANGELOG.md) · Giả định: [docs/spec/phase-3.md](../spec/phase-3.md) · Bằng chứng: [docs/proof/phase-3/](../proof/phase-3/)

## 1. Kết quả
| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| Đèn có dầu, châm dầu, tắt, thắp lại cần 5 | `tests/phase3.test.js` | Đạt |
| Bóng Mực hút dầu (`drain`), mất vùng an toàn khi < 30 | `tests/phase3.test.js` | Đạt |
| Luật thắng `dawn_survived`, không thắng sớm, thời lượng 240/270/300 | `tests/phase3.test.js`, `tests/contract.test.js` | Đạt |
| Sức chứa tăng dần | `tests/phase3.test.js` | Đạt |
| Điểm mới | các test refuel, relight, pulse +15, bonus bình minh | Đạt |
| Contract v1.2 | test "v1.2 and mirrors…", mã thoát 2 | Đạt |
| Hiển thị: thanh dầu, nhấp nháy 1 Hz khi < 30, HUD mang/sức chứa, cần k đèn | code + `night1-start.png` | Đạt một phần: thanh dầu và nhấp nháy **chưa có ảnh chụp**, chưa chơi thử |
| Chế độ mù màu (lưu `localStorage`) | code (`settings.colorblind`) | **Chưa kiểm thử thủ công** |
| ADR, changelog | `docs/adr/0001…`, `CHANGELOG.md` | Đạt |
| Test cũ bị luật mới làm sai | 5 chỗ ghi `// P3:`; test "thắng sớm" được thay bằng "P3: lighting every lantern does not end the night" và có ghi lý do | Đạt, không skip test nào |
| Test Phase 1–2 không bị thay thế | 59/59 pass | Đạt |

## 2. AI và lỗi
- Lỗi trong test do AI viết: kỳ vọng fuel 40 sau khi châm, nhưng đúng luật là 39.9, vì ở bước 2 Bóng Mực hút dầu trước khi Mây châm ở bước 5. Đã sửa test, game giữ nguyên.
- Mutation: cài 4 lỗi (đèn không tắt, đèn yếu vẫn có vùng an toàn, thắp lại tốn 10, thắng chỉ cần 1 đèn); cả 4 đều bị test bắt.
- Token (ước tính): khoảng 80–100k. Tiết kiệm bằng cách sửa đúng chỗ (bằng script có kiểm tra chuỗi khớp) thay vì viết lại cả file.

## 3. Còn thiếu
- Chơi thử thủ công luật mới (châm dầu, Bóng Mực hút dầu) và chế độ mù màu; đo FPS. Dự kiến làm đầu Phase 4.
