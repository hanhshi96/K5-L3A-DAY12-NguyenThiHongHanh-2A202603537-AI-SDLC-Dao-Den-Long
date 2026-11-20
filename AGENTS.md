# AGENTS.md — Đảo Đèn Lồng

Hướng dẫn cho mọi agent AI làm việc trên repo này. Đọc hết trước khi sửa code.

## Lệnh
- Test: `npm test` (node:test, không cần dependency). Phải xanh trước khi kết thúc. Stop hook trong `.claude/settings.json` sẽ chặn nếu test còn đỏ.
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl`
- Chạy game: `npm start`, rồi mở http://localhost:5173 (thêm `?autostart` để bỏ màn intro)
- Sinh bằng chứng: `scripts/proof.sh phase-N`, kết quả ghi vào `docs/proof/phase-N/`

## Kiến trúc (bất biến)
- **Mọi luật chơi nằm trong `src/sim/sim.js`**: JS thuần, không DOM, không `Math.random`, không `Date`. Ngẫu nhiên chỉ dùng `g.rng` (seed).
- `src/web/` chỉ hiển thị, âm thanh và đọc input. Không được đặt luật chơi ở đây.
- Tuning: sửa `TUNING` trong sim.js rồi sinh lại `game.contract.json` (cả hai phải giống hệt nhau; có test kiểm tra).
- Thứ tự trong một bước: di chuyển/nhảy → nhặt → interact → pulse → Bóng Mực → va chạm → spawn → thời gian và kết thúc.

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
- Đếm tick lệch 1 khi bị choáng (choáng 179 thay vì 180 tick): mọi bộ đếm thời lượng đều phải có test kiểm tra biên.
- Ở yaw 0, camera nhìn theo +Z nên bên phải màn hình là −X: phím D gửi `x = -1`.
