# Changelog

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
