# Phase 1: giả định, truy vết, nhật ký AI, đánh giá

## 1. Giả định (chỗ PRD-0 còn mơ hồ)

| # | Chủ đề | Giả định |
|---|---|---|
| A1 | Nhặt đom đóm | Tự động mỗi tick khi khoảng cách XZ ≤ `pickup_radius`, nếu chưa mang đủ `carry_capacity`. Nhiều con trong cùng một tick thì nhặt theo thứ tự id. |
| A2 | Nạp đèn | Cạnh lên của `interact` khi có đèn **chưa thắp** trong `interact_radius` (chọn đèn gần nhất). Lượng nạp = min(carried, `lantern_cost` − deposited). Không mang gì thì không phát event. |
| A3 | Thắp đèn | Đèn sáng khi deposited ≥ `lantern_cost`. Scenario đặt `lit: true` mà không ghi `deposited` thì coi như deposited = `lantern_cost`. |
| A4 | Tỏa sáng | Tốn `pulse_cost` đom đóm đang mang ("tốn ánh sáng"). Không đủ hoặc đang hồi chiêu thì không có gì xảy ra và không phát event. Nếu đủ thì luôn phát `pulse`, kể cả khi `stunned_ids` rỗng. |
| A5 | Choáng / đẩy | Bóng Mực trong `pulse_radius` bị choáng đúng `pulse_stun_s`·60 tick (không di chuyển, không gây sát thương) và bị đẩy `pulse_push_m` ra xa người chơi theo XZ. Pulse lại vào con đang choáng thì đặt lại thời gian choáng. |
| A6 | Bị chạm | Bóng Mực không choáng và cách ≤ `shade_hit_radius`: Mây mất 1 lửa, rơi floor(carried·`hit_drop_ratio`) đom đóm (biến mất, không rơi lại xuống đất), bất tử `invuln_s` giây. Mỗi tick bị trúng tối đa 1 lần. |
| A7 | Vùng an toàn | Chỉ **đèn đã thắp** đẩy Bóng Mực ra ngoài `safe_radius` (luôn giữ khoảng cách > r). Lý do: "Bóng Mực sợ những chiếc đèn" được hiểu là sợ ánh sáng; đèn tắt thì không có ánh sáng. |
| A8 | Hết giờ | `time_left_s` về 0 thì thua với `reason: dawn`. Nếu trong cùng tick vừa thắp đèn cuối vừa hết giờ thì tính thắng. |
| A9 | Rơi khỏi đảo | `fall_enabled: false`. Đảo bán kính 40 m, mép đảo là tường. |
| A10 | Điểm thưởng | Chỉ cộng khi thắng: floor(time_left_s)·`per_second_left` + flames·`per_flame_left`. |
| A11 | Bóng Mực ngẫu nhiên | Mặc định có 3 con lúc đầu (dựng màn, không phát event). Cứ 30 giây sinh thêm 1 con (phát `shade_spawned`), tối đa 6 con. |
| A12 | Đom đóm ngẫu nhiên | Mặc định có 40 con. Cứ 2 giây, nếu còn dưới 20 con thì sinh thêm 1 con. |
| A13 | Trạng thái Bóng Mực | `chase` (người chơi trong 15 m), `wander`, `stunned`. Bóng Mực ở độ cao Y = 1. |
| A14 | Nhảy | Vận tốc 6 m/s, trọng lực 20 m/s² (khoảng 0.9 m). Không ảnh hưởng tới va chạm vì khoảng cách đo trên XZ. |
| A15 | Mã thoát | 2 khi file JSON sai cú pháp hoặc sai schema (tick không tăng, move ngoài [−1, 1], kiểu sai, id đèn lạ). 1 khi sai tham số CLI hoặc `--night` khác 1. |

## 2. Truy vết yêu cầu → kiểm chứng → kết quả

| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| Contract JSON khớp số game dùng | test `tuning mirrors…` | Đạt |
| Tick model, snapshot, end line | tests `tick 0…`, `--ticks N…` | Đạt |
| Input: mặc định, giữ giá trị, yaw, chuẩn hóa | tests `movement…`, `input frames…` | Đạt |
| Nhặt, sức chứa | tests `pickup…`, `carry_capacity…` | Đạt |
| Nạp, thắp đèn, setup không cộng điểm | tests `deposit…`, `partial deposit…`, scenario `light-L1` | Đạt |
| Thắng (all_lit) + điểm thưởng | test `lighting the last lantern…` | Đạt |
| Tỏa sáng, choáng, đẩy, hồi chiêu | tests `pulse…`, `stun lasts…`, scenario `pulse-shade` | Đạt |
| Bị chạm, rơi đom đóm, bất tử, thua no_flames | test `shade chases and hits…` | Đạt |
| safe_radius | test `shades never enter…` | Đạt |
| Thua dawn | test `dawn…` | Đạt |
| Tất định | test `determinism…` + `docs/proof/phase-1/determinism.txt` | Đạt |
| Sai định dạng → exit 2 | test `malformed…` | Đạt |
| Game 3D chơi được, HUD, chơi lại | ảnh `docs/proof/phase-1/screenshot-start.png` (Chrome headless, `?autostart`), chơi thử thủ công | Ảnh: đạt. **Đạt.** Người dùng chơi thử thủ công ngày 20/11/2026: thắng (5/5 đèn, còn 3 lửa), điểm 1388. Ảnh `docs/proof/phase-1/manual-play-won.png`. Điểm khớp luật: 29 đom đóm×10 + 5 đèn×100 + 224 s×2 + 3 lửa×50 = 1388. |
| Mây đội nón lá có treo đèn | ảnh chụp | Đạt |

Test đã được kiểm tra chéo bằng mutation: đổi `<=` thành `<` ở pickup, tắt safe_radius, giảm thời gian choáng đi 1 tick. Mỗi trường hợp đều làm đúng 1 test đỏ, nên test không phải loại "luôn đạt".

## 3. Nhật ký dùng AI

- Công cụ: Claude Code (Opus) trong VS Code. Người điều phối đọc PRD, chốt hướng kỹ thuật (Three.js + Node, sim dùng chung).
- Quy trình: học viên đọc PRD -> agent tóm tắt PRD, liệt kê chỗ mơ hồ và đề xuất giả định -> người duyệt -> viết sim -> viết test contract -> mutation check -> client 3D -> harness và tài liệu.
- AI sai và đã sửa:
  - Bộ đếm choáng lệch 1 tick (179 thay vì 180). Agent tự phát hiện khi rà lại mô hình tick, sửa trước khi chạy test, và ghi bài học vào AGENTS.md.
  - Server trả `index.html` ở `/` làm đường dẫn tương đối `./main.js` bị gãy. Phát hiện khi review, sửa bằng redirect 302, kiểm chứng bằng curl.
  - Màn intro ghi phím `E` cho xoay camera, trùng với phím interact. Đã sửa thành Q/C.
- Token (ước tính): khoảng 60–80k token cho Phase 1. Cách tiết kiệm: không dùng subagent; viết sim và test theo lô lớn; chỉ đọc tài liệu lab cần thiết; dùng mutation check có chọn lọc thay vì chạy lại test nhiều lần.

## 4. Đánh giá Phase 1

- Đạt: toàn bộ Test Contract v1.0 có test (22/22 pass), headless chạy 18000 tick dưới 0.1 giây.
- Rủi ro: giả định A7 (chỉ đèn đã thắp mới có safe_radius) và A4 (pulse tốn đom đóm) có thể khác cách hiểu của bộ test ẩn. Nếu Phase 2 làm rõ thì sửa trong `sim.js`, có sẵn test để cập nhật.
- Chơi thử thủ công: thắng trọn một màn, điểm khớp luật tính điểm.
- Cần chỉnh: quay video chơi thử ở Phase 4.
