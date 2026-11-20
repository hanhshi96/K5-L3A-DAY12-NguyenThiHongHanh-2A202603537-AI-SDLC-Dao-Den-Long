# AGENTS.md — Đảo Đèn Lồng

Hướng dẫn cho mọi agent AI làm việc trên repo này. Đọc hết trước khi sửa code.

## Lệnh
- Test: `npm test` (node:test, không cần dependency). Phải xanh trước khi kết thúc. Stop hook trong `.claude/settings.json` sẽ chặn nếu test còn đỏ.
- Headless: `node src/headless.js --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl` (Contract v1.1)
- Chạy game: `npm start`, rồi mở http://localhost:5173 (thêm `?night=2&autostart` để vào thẳng một Đêm)
- Sinh bằng chứng: `scripts/proof.sh phase-N`, kết quả ghi vào `docs/proof/phase-N/`

## Kiến trúc (bất biến)
- Bản đồ chuẩn của 3 Đêm nằm trong `src/sim/nights.js`; spec và giả định nằm trong `docs/spec/phase-N.md`.
- **Mọi luật chơi nằm trong `src/sim/sim.js`**: JS thuần, không DOM, không `Math.random`, không `Date`. Ngẫu nhiên chỉ dùng `g.rng` (seed).
- `src/web/` chỉ hiển thị, âm thanh và đọc input. Không được đặt luật chơi ở đây.
- Tuning: sửa `TUNING` trong sim.js rồi sinh lại `game.contract.json` (cả hai phải giống hệt nhau; có test kiểm tra).
- Thứ tự mỗi tick (Ticket-02, bắt buộc): pause → giảm bộ đếm → di chuyển Mây và kiểm tra rơi → nhặt → đèn → vùng an toàn → pulse → Bóng Mực và Gió Lạc → chạm (Gió Lạc trước, Bóng Mực theo id) → spawn → thắng/thua → snapshot.

## Quy ước Test Contract (dễ sai)
- Snapshot tick 0 là trạng thái trước input. Bước k đọc input tick k, sự kiện ghi `tick = k+1`.
- Khoảng cách đo trên XZ, "trong bán kính" nghĩa là `<=`. Nút chỉ kích hoạt ở cạnh lên (false → true).
- Dựng scenario không phát event, không cộng điểm. Đầu vào sai định dạng thì exit 2.
- Phần sáng tạo không được làm đổi output headless.

## Quy tắc làm việc
- Viết hoặc cập nhật test **trước** khi đổi hành vi. Không được nới lỏng test để nó pass. Nếu đổi test thì ghi lý do trong `docs/notes/`.
- Giả định mới ghi vào `docs/notes/phase-N.md`.
- Bằng chứng phải sinh từ code bằng `scripts/proof.sh`, không được sửa tay.
- Commit nhỏ, thông điệp rõ ràng.

## Bài học (cập nhật khi agent sai)
- Mọi bộ đếm (hồi chiêu, choáng, TTL, flee…) giảm ở bước 2; đặt giá trị ở bước sau thì giữ đúng N tick. Lệch 1 tick là lỗi hay gặp nhất.
- Test đỏ: đọc output headless thật trước, xác định game sai hay test sai, rồi mới sửa. Không nới lỏng assert cho tới khi pass.
- So sánh vị trí trong snapshot phải tính tới làm tròn 3 chữ số; dùng sai số cho phép với số thực.
- Thế giới test `quiet()` phải tắt mọi thực thể mặc định (Gió Lạc, Bùa Gió), nếu không chúng sẽ xen vào test.
- Đếm tick lệch 1 khi bị choáng (choáng 179 thay vì 180 tick): mọi bộ đếm thời lượng đều phải có test kiểm tra biên.
- Ở yaw 0, camera nhìn theo +Z nên bên phải màn hình là −X: phím D gửi `x = -1`.
