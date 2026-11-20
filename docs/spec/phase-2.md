# Spec Phase 2: Ticket-02 "Ba hòn đảo" (Contract v1.1)

Nguồn: Ticket-02. Tài liệu này ghi (1) các thay đổi so với Phase 1, (2) giả định cho những chỗ ticket chưa nói rõ, (3) tiêu chí nghiệm thu (AC) cho từng tính năng ở Phần 3. Mỗi AC có cột "Kiểm chứng" chỉ tới test hoặc bằng chứng tương ứng.

## 1. Thay đổi so với Phase 1 (do số liệu chuẩn)

| Luật | Phase 1 | Phase 2 | Test Phase 1 bị ảnh hưởng |
|---|---|---|---|
| Nhảy | 6 m/s | 7 m/s | không có |
| Nhặt | XZ ≤ 1.2 | XZ ≤ 1.0 **và** chênh cao ≤ 1.5 | test dùng `T.pickup_radius`, tự cập nhật |
| Chi phí đèn / tương tác | 5 / 2.5 m | 10 / 2.0 m, bằng nhau thì chọn id nhỏ hơn | dùng số từ contract |
| Vùng an toàn | 5 m, mọi lúc | 6 m; Bóng Mực ở trong thì bị đẩy ra trong ≤ 30 tick, không gây sát thương | sửa test safe_radius |
| Tỏa sáng | 2 / 6 m / 1 s, đo XZ | 3 / 5 m / 3 s, đo **3D** từ chân + 0.8 m | sửa test vị trí đẩy |
| Choáng / đẩy | 180 tick, đẩy tức thì | 120 tick, đẩy 4 m chia đều trong 15 tick | sửa test đẩy |
| Bị chạm | đom đóm rơi là mất | rơi xuống vòng 1.5–2.5 m quanh Mây, tồn tại 480 tick; Bóng Mực vừa đánh thì `recoil` | sửa test hit |
| Rơi khỏi đảo | tắt | bật (Y < −10) | mới |
| Điểm đom đóm | +10 khi nhặt | **+10 khi nạp** | sửa test điểm |
| Điểm tỏa sáng | +25 | +5 mỗi Bóng Mực trúng (kể cả đang choáng) | số từ contract |
| Sinh Bóng Mực | 3 con lúc đầu, cứ 30 s thêm 1 | 2 con ở tick 300, sau đó theo lịch từng Đêm, chỉ ở điểm cách người chơi ≥ 15 m | sửa test spawn |
| Trạng thái Bóng Mực | tự đặt | `spawning`, `wander`, `chase`, `recoil`, `stunned` | sửa |

Lý do sửa test: yêu cầu của khách hàng đã thay đổi. Mỗi test được sửa có ghi chú `// P2:` giải thích.

## 2. Giả định (ticket chưa nói rõ)

| # | Chủ đề | Giả định |
|---|---|---|
| G1 | Tăng tốc | Tức thời (0 s ≤ 0.1 s). Trên không điều khiển như dưới đất. |
| G2 | Hướng nhân vật | Là hướng di chuyển khác 0 gần nhất; ban đầu là +Z. |
| G3 | Lướt | 12 tick × 14 m/s theo hướng move (hoặc hướng nhân vật); bỏ qua input move; trên không thì giữ nguyên Y (không tính trọng lực). Hồi chiêu 90 tick tính từ tick bắt đầu lướt. Sau khi lướt từ bục nhảy, tiếp tục với vận tốc phóng. |
| G4 | Trạng thái `spawning` | Bóng Mực sinh theo lịch ở `spawning` 60 tick: đứng yên, không gây sát thương. Bóng Mực trong scenario hoạt động ngay (`wander`), trừ khi scenario ghi `state`. |
| G5 | Chênh cao khi chạm | So `player.pos.y` (chân) với `shade.pos.y` (tâm). Bóng Mực bay ở độ cao mặt đất bên dưới + 1 m và đi xuyên vách tầng (chúng là sương mực). |
| G6 | Lang thang | Bóng Mực lang thang với tốc độ 50% tới một điểm ngẫu nhiên (theo seed) trên đảo. |
| G7 | Đẩy khỏi vùng an toàn | Đẩy ra theo hướng xuyên tâm với tốc độ 0.2 m/tick (từ tâm tới mép 6 m mất ≤ 30 tick). |
| G8 | Đom đóm ngẫu nhiên | "Trần 30" chỉ tính đom đóm `random`. "Điểm trống" là điểm sinh chưa có đom đóm `random`. Tick 0 sinh 20 con ở 20 điểm khác nhau, chọn theo seed. |
| G9 | Vị trí đom đóm rơi | n con chia đều góc trên vòng tròn, bán kính ngẫu nhiên trong [1.5, 2.5], độ cao bằng mặt đất tại đó (nếu ngoài đảo thì lấy độ cao chân Mây). |
| G10 | Rơi khỏi đảo | `player_hit {by:"fall", flames, dropped:0, lost:n}`. Trong 60 tick chờ: đứng yên ở chỗ rơi, không nhặt được, không bị chạm. Hồi sinh tại điểm xuất phát của Đêm. |
| G11 | Điểm xuất phát | Đêm 1 và 2: (0,0,0). **Đêm 3: (0,0,−30)**, vì tâm đảo là tháp chuông trên tầng 2. Hướng mặt ban đầu là +Z. |
| G12 | Vách và dốc | Không đi lên được bề mặt cao hơn chân > 0.3 m (bị chặn theo phương ngang). Dốc là dải rộng 3 m, cao độ tăng tuyến tính từ r = 30 (Y = 0) tới r = 24 (Y = 3). Tháp chuông (r ≤ 2) là vật cản. |
| G13 | Bục nhảy | Kích hoạt khi chân Mây cách tâm bục ≤ 1 m (XZ), đang đứng trên đất, cùng độ cao. |
| G14 | Gió | Đêm 3: cơn gió bắt đầu ở tick 1800·k (k ≥ 1), kéo dài 300 tick, hướng theo seed. `wind.dir_deg` là hướng của cơn gió hiện tại hoặc sắp tới; khi không có gió thì `active: false`. |
| G15 | Góc | θ đo từ +X, điểm = (r·cosθ, y, r·sinθ). Kiểm tra lại: các điểm tầng 1 Đêm 3 (20°…160°) đều có z > 0, khớp với ticket. |
| G16 | Gió Lạc | Sinh trên các điểm sinh Bóng Mực. "Tối đa 2" chỉ tính con chưa `removed`. Con `removed` vẫn còn trong snapshot. Chỉ cướp khi đang `idle` hoặc `chase` và Mây mang > 0. Chạm chỉ xét khoảng cách XZ. |
| G17 | Tỏa sáng trúng Gió Lạc | Cùng điều kiện 3D ≤ 5 m. Không tính vào `stunned_ids` và không cộng điểm. |
| G18 | Điểm khi chạy headless | `score` là điểm của Đêm đang chạy (kể cả khi thua). Trong game có giao diện, tổng điểm là tổng điểm các Đêm đã thắng. |
| G19 | Tạm dừng | Nhấn `pause` (cạnh lên) để bật/tắt. Bước tạm dừng dừng ngay sau khi đọc input. `--ticks` đếm cả các bước đang tạm dừng. |

## 3. Tiêu chí nghiệm thu (Phần 3)

| # | Tính năng | Tiêu chí nghiệm thu | Kiểm chứng |
|---|---|---|---|
| F1 | Gió Lạc | (a) Sinh ở tick 1200·k, id D1, D2…, tối đa 2 con chưa `removed`, chỉ ở Đêm 2 và 3. (b) Chuyển `idle → chase` khi carried ≥ 5 và khoảng cách ≤ 15 m; mất điều kiện thì về `idle`. (c) Chạm (XZ ≤ 1.2): cướp min(3, carried), phát `drifter_steal`, chuyển `flee`, sau 240 tick thì `removed`; chỉ cướp 1 lần. (d) Bị tỏa sáng khi `chase` thì `flee`, không cướp. Bị tỏa sáng khi `flee` đang mang đồ cướp thì phát `drifter_drop`, đom đóm thành loại `dropped`, sau 120 tick thì `removed`. (e) Không làm mất lửa, không bị vùng an toàn chặn, bất tử không ngăn bị cướp. | `tests/phase2.test.js` (drifter) |
| F2 | Bùa Gió | (a) Nhặt theo luật đom đóm, phát `charm_picked {charm_id, charm_ticks: 600}`. (b) Trong 600 tick: tốc độ 7.2 m/s, lướt không hồi chiêu (vẫn phải nhấn lại; nhấn khi đang lướt thì bỏ qua). (c) Nhặt lại thì làm mới thời gian. (d) Xuất hiện lại sau 2700 tick. (e) Vị trí: Đêm 2 (35,0,0); Đêm 3 (30,0,25), (−30,0,25). | `tests/phase2.test.js` (charm) |
| F3 | Chuỗi 3 Đêm | Menu → giới thiệu Đêm (tên đảo, lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp. Thắng Đêm 3 thì hiện màn hình Bình Minh với tổng điểm. Thua thì chơi lại Đêm đó. Headless: `--night 1/2/3` dựng đúng bản đồ và phát `night_start`. | chơi thử + ảnh chụp; test `night_start`, bản đồ |
| F4 | Tạm dừng | Esc/P dừng toàn bộ logic. Menu có Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu. Headless: khi tạm dừng `tick` vẫn tăng, còn `sim_tick`, thời gian, hồi chiêu, spawn, TTL đứng yên; snapshot ghi `state: "paused"`; có sự kiện `paused` và `resumed`. | test pause; chơi thử |
| F5 | Cài đặt | Âm lượng và độ nhạy chuột, lưu trong `localStorage`, giữ nguyên sau khi tải lại trang. | chơi thử: đổi giá trị, tải lại trang, giá trị còn nguyên |
| F6 | Âm thanh | Nhạc nền riêng mỗi Đêm, cùng hiệu ứng cho: nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối (WebAudio tổng hợp). | chơi thử, video |
| F7 | HUD | Lửa (trên trái); mm:ss (trên giữa, đỏ và nhấp nháy khi ≤ 30 s); đèn k/n và điểm (trên phải); thanh đom đóm 10 ô (dưới giữa); biểu tượng hồi chiêu Lướt và Tỏa sáng (dưới phải); nhắc "E — Nạp ánh sáng (x/10)"; mũi tên chỉ đèn chưa sáng gần nhất khi đèn ngoài màn hình. | ảnh chụp |
| F8 | Bảng màu | Các thành phần được liệt kê dùng đúng mã hex trong ticket (lệch ≤ 10%). Cường độ ánh sáng môi trường = 0.15 + 0.55 × (đèn sáng / tổng đèn). | đối chiếu code (hằng `PALETTE`) |
| C1 | Contract v1.1 | `contract_version: "1.1"`, tuning khớp số chuẩn và có thêm 5 khóa mới; snapshot, scenario, input, event bổ sung đủ theo Phần 4; chạy một Đêm 21.600 tick trong ≤ 30 s. | `tests/contract.test.js`, `tests/phase2.test.js`, `timing.txt` |
| C2 | Lướt | 14 m/s trong 12 tick, hồi chiêu 90 tick tính từ lúc bắt đầu, phát `dash {}`, không bất tử, trên không giữ nguyên độ cao. | test dash |
| C3 | Đêm 2, Đêm 3 | Đèn, điểm sinh, cầu, tầng, dốc, bục nhảy, gió đúng như Phần 2 của ticket; bục nhảy Đêm 2 đưa Mây đáp xuống đảo bên kia; rơi ngoài đảo thì mất lửa và hồi sinh. | test bục nhảy, test rơi, test đèn |
