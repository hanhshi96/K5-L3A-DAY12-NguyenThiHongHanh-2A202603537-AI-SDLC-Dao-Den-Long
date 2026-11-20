# ADR 0001: Đèn có dầu và luật thắng "giữ sáng tới bình minh"

- Trạng thái: Chấp nhận (Phase 3, Ticket-03, Contract v1.2)
- Thay thế: luật Phase 2 "đèn đã sáng không nhận thêm đom đóm", "Bóng Mực không bao giờ vào vùng an toàn", "thắng ngay khi mọi đèn sáng", công thức điểm cũ.

## Bối cảnh
Khi chơi thử, người giỏi thắp hết đèn trong khoảng 2 phút là kết thúc Đêm, cuối Đêm không còn căng thẳng. Khách hàng muốn mục tiêu là "giữ đảo sáng tới bình minh".

## Quyết định
1. **Mô hình trạng thái đèn**: `unlit → lit → (hết dầu) → unlit(ever_lit)`. Mỗi đèn có `fuel`, `ever_lit`, `relit_count`, `deposited`. Thắp lần đầu cần 10, thắp lại chỉ cần 5. Khi tắt, `deposited = 0`.
2. **Dầu là số nguyên** theo đơn vị 1/60 (`fuelU = fuel × 60`, tối đa 6000). Tự hao 1 đơn vị mỗi tick, mỗi Bóng Mực đang hút thêm 5 đơn vị mỗi tick. Không có sai số số thực; chỉ làm tròn 1 chữ số khi ghi snapshot.
3. **Thứ tự trong tick**: ở bước 2 trừ dầu (hao + hút), ngay sau bước 2 thì đèn có `fuel ≤ 0` tắt (`lantern_out`). Những bước khác giữ nguyên theo Ticket-02.
4. **Vùng an toàn** chỉ tồn tại khi `lit && fuel ≥ 30`. Đèn được châm lên ≥ 30 thì đẩy Bóng Mực ra mép, giống như khi đèn vừa thắp; Bóng Mực đang `drain` bị đẩy ra thì về `wander`.
5. **Bóng Mực có trạng thái `drain`**: đang `wander` (và không thấy Mây) thì đi tới đèn yếu gần nhất với tốc độ đuổi; khi cách ≤ 2 m thì `drain`, đứng yên, không gây sát thương. Thoát `drain` theo thứ tự ưu tiên: bị tỏa sáng → `stunned`; Mây trong 6 m → `chase`; đèn tắt, được châm ≥ 30 hoặc cách > 2 m → `wander`.
6. **Thắng/thua** chỉ xét ở tick hết giờ (trừ hết lửa thì thua ngay): còn sống và số đèn sáng ≥ ceil(0.6 × tổng) thì `won/dawn_survived`, ngược lại `lost/dawn`. Không còn thắng sớm.

## Hệ quả
- Test Phase 1–2 về "thắng ngay khi đủ đèn", điểm cũ và thời lượng cũ phải sửa (xem [CHANGELOG.md](../../CHANGELOG.md)).
- Snapshot và scenario thêm trường (Contract v1.2). Client 3D thêm thanh dầu, nhấp nháy khi < 30 và chế độ mù màu.
- Rủi ro: tốc độ đi tới đèn yếu và thời điểm phát `fuel_drain` là giả định (spec Phase 3).
