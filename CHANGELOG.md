# Changelog

## [v1.0.0 / phase-4] — Ticket-04 "Bình minh: phát hành v1.0.0", Contract v1.3
### Thêm
- Benchmark `node scripts/bench.js --seed 42 --duration 30 --out bench.json` (cảnh chuẩn 200 Bóng Mực, 100 đom đóm, camera bay vòng).
- Soak test `node --expose-gc --jitless src/soak.js --seed 7 --nights 10 --out soak.json`.
- Bảng xếp hạng top 10 lưu trên đĩa (`data/leaderboard.json`), có màn hình riêng; lệnh `node server.js --export-leaderboard out.json`.
- Dễ tiếp cận: đổi phím (phát hiện trùng phím, khôi phục mặc định), phụ đề và cảnh báo bằng hình, giảm chuyển động, chữ ≥ 18 px, chữ lớn ×1.25.
- Phần sáng tạo (chỉ hiển thị, không đổi output headless): nhân vật Mây chibi mới (`src/web/may.js`), trang trí đảo (`src/web/decor.js`), đom đóm có quầng và cột sáng, mũi tên chỉ đom đóm gần nhất, hiệu ứng Tỏa sáng từ đèn lồng, góc nhìn từ trên xuống (phím `V`, hành động mới "Đổi góc nhìn" trong Cài đặt).
- Bản phát hành `dao-den-long-v1.0.0.zip` (chạy bằng `node server.js`, không cần `npm install`).
### Thay đổi
- `contract_version` "1.2" → "1.3"; thêm `bench_cmd`, `soak_cmd`. `run_cmd` đổi từ `npm start` thành `node server.js` (để nhận tham số `--export-leaderboard`).
- Three.js cài qua npm (`three@0.160.0`) thay vì tải từ CDN: chơi không cần mạng.
- Phím tạm dừng mặc định là `P` (Esc luôn tạm dừng được); phím của mọi hành động có thể đổi.
- `puppeteer` là phụ thuộc tùy chọn và không tải trình duyệt khi `npm install` (`.puppeteerrc.cjs`), vì tải lỗi sẽ làm hỏng cả bước cài đặt.

## [phase-3] — Ticket-03 "Đèn cạn dầu", Contract v1.2
### Breaking changes
- `contract_version` "1.1" → "1.2". Tuning thêm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`.
- Thời lượng Đêm 300/330/360 s → **240/270/300 s**.
- **Không còn thắng sớm**: `game_over.reason` `all_lit` bị bỏ; thắng là `dawn_survived` (còn sống lúc hết giờ và số đèn sáng ≥ 60%).
- Đèn đang sáng **nhận thêm đom đóm** để châm dầu (sự kiện `refuel`); hết dầu thì tắt (`lantern_out`); thắp lại cần 5.
- Vùng an toàn chỉ còn khi fuel ≥ 30. Bóng Mực có trạng thái mới `drain` (sự kiện `fuel_drain`).
- `lantern_lit` thêm trường `relight`. Snapshot đèn thêm `fuel`, `ever_lit`, `relit_count`; player thêm `capacity`.
- Sức chứa = 10 + 2 × số lần thắp thành công (tối đa 20), không cố định 10.
- Điểm: +5/đom đóm nạp (trước +10), +40 khi thắp lại, tỏa sáng trúng Bóng Mực đang `drain` +15, bình minh +50 + floor(fuel) mỗi đèn sáng; **bỏ thưởng thời gian** (`per_second_left` = 0).
### Thêm
- Cài đặt "Bảng màu dễ phân biệt" (được lưu).

## [phase-2] — Ticket-02 "Ba hòn đảo", Contract v1.1
- Số liệu chuẩn, 3 Đêm, Lướt, Tạm dừng, Gió Lạc, Bùa Gió, rơi khỏi đảo. Chi tiết: docs/spec/phase-2.md.

## [phase-1] — PRD-0, Contract v1.0
- Đêm 1, headless, test contract.
