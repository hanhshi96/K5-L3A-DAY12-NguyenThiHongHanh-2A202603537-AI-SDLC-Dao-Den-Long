# Đảo Đèn Lồng

> Video demo: *(sẽ bổ sung ở Phase 4)*
> Day 12 · AI SDLC Lab · 2A202603537 · Nguyễn Thị Hồng Hạnh · Tài liệu lab gốc: [docs/lab/](docs/lab/)

Game 3D góc nhìn thứ ba (Three.js, chạy trên trình duyệt). Người chơi điều khiển Mây, người giữ đèn đội nón lá có treo một chiếc đèn lồng nhỏ. Mây gom đom đóm để thắp lại 5 Đèn Lồng Lớn của Đảo Bến trước bình minh, đồng thời né hoặc xua Bóng Mực.

## Cài đặt và chạy

Yêu cầu Node.js ≥ 18 và trình duyệt có WebGL. Máy cần có mạng, vì Three.js được tải từ CDN jsdelivr.

```bash
npm install        # không có dependency ngoài, chỉ kiểm tra môi trường
npm start          # mở http://localhost:5173
npm test           # 59 test: Test Contract v1.2 + tính năng Phase 2–3 + scenario riêng
```

Chạy headless theo Test Contract v1.0:

```bash
node src/headless.js --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

Lệnh `scripts/proof.sh phase-3` sinh lại toàn bộ bằng chứng vào [docs/proof/phase-3/](docs/proof/phase-3/).

## Điều khiển

| Phím | Hành động |
|---|---|
| `W A S D` / phím mũi tên | Di chuyển theo hướng camera |
| `Space` | Nhảy |
| `Shift` | Lướt (14 m/s trong 0.2 s, hồi chiêu 1.5 s) |
| Kéo chuột, hoặc `Q` / `C` | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| `E` | Nạp đom đóm vào đèn gần nhất (trong 2 m) |
| `F` | Tỏa sáng: tốn 3 đom đóm, làm choáng Bóng Mực trong 5 m |
| `Esc` / `P` | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |
| `Enter` | Bắt đầu, sang Đêm kế tiếp, chơi lại khi thua |

## Luật chơi và cách tính điểm (Ticket-03, Contract v1.2)

Ba Đêm nối tiếp nhau: **Đảo Bến** (5 đèn, 240 s), **Đảo Cau** (2 đảo, cầu tre, bục nhảy, 6 đèn, 270 s), **Đảo Chuông** (3 tầng, gió mạnh, 7 đèn, 300 s). Mỗi Đêm Mây có lại đủ 3 lửa.

- **Mục tiêu: giữ đảo sáng tới bình minh.** Thắng khi còn sống lúc hết giờ và số đèn đang sáng ≥ 60% (3/5, 4/6, 5/7). Không còn thắng sớm.
- Thắp đèn lần đầu cần 10 đom đóm. Đèn sáng có **dầu 100**, giảm 1 mỗi giây. Nhấn `E` ở đèn sáng để châm (+10 dầu mỗi đom đóm). Hết dầu thì đèn tắt; thắp lại chỉ cần 5.
- Đèn có dầu < 30 nhấp nháy và **mất vùng an toàn**: Bóng Mực sẽ tới hút dầu (5/giây). Tỏa sáng (`F`) để xua.
- Sức chứa = 10 + 2 × số lần thắp thành công (tối đa 20).
- Bóng Mực chạm thì mất 1 lửa và rơi một nửa số đom đóm đang mang. Rơi khỏi đảo thì mất 1 lửa và toàn bộ đom đóm. **Gió Lạc** (Đêm 2–3) cướp đom đóm. **Bùa Gió** cho 10 s chạy nhanh và lướt không hồi chiêu.
- Cài đặt có **"Bảng màu dễ phân biệt"** cho người mù màu.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn (thắp, thắp lại, châm dầu) | +5 |
| Thắp lần đầu / thắp lại | +100 / +40 |
| Mỗi Bóng Mực trúng tỏa sáng (đang hút dầu) | +5 (+15) |
| Bình minh khi thắng: mỗi đèn đang sáng | +50 + phần nguyên của dầu |
| Bình minh khi thắng: mỗi lửa còn lại | +50 |

Tổng điểm là tổng điểm các Đêm đã thắng. Quyết định thiết kế: [ADR 0001](docs/adr/0001-lantern-fuel-and-dawn-win.md); thay đổi phá vỡ tương thích: [CHANGELOG.md](CHANGELOG.md).

## Test Contract

- Tệp [game.contract.json](game.contract.json) được sinh từ `TUNING` trong [src/sim/sim.js](src/sim/sim.js). Test `tuning mirrors…` kiểm tra hai bên giống hệt nhau.
- Contract **v1.2** (Phase 3). `fall_enabled: true` (từ Phase 2): rơi khỏi đảo (Y < −10) phát `player_hit` với `by: "fall"` và trường `lost`.
- Logic game nằm trong một module JS thuần ([src/sim/sim.js](src/sim/sim.js)), dùng chung cho bản 3D ([src/web/main.js](src/web/main.js)) và headless ([src/headless.js](src/headless.js)). Vì vậy hai bản không thể lệch luật nhau.
- Ngẫu nhiên dùng PRNG mulberry32 theo `--seed`, nên output tất định.
- Mã thoát: `0` khi thành công; `2` khi file inputs/scenario sai định dạng; `1` khi sai tham số dòng lệnh.
- Các giả định chi tiết nằm ở [docs/notes/phase-1.md](docs/notes/phase-1.md).

## Sáng tạo của tôi

Toàn bộ phần sáng tạo **chỉ nằm ở lớp hiển thị** ([src/web/main.js](src/web/main.js)) và không đụng tới simulation, nên output headless không đổi.

1. **Đảo sáng dần:** mỗi đèn được thắp làm nền trời và sương ấm lên, sương mỏng đi, ánh sáng môi trường tăng. Đèn chưa thắp cũng hửng dần theo số đom đóm đã nạp.
2. **Đèn nón lá sáng theo số đom đóm:** chiếc đèn nhỏ của Mây to và sáng hơn khi mang nhiều đom đóm.
3. **Âm thanh tổng hợp bằng WebAudio** (không dùng file âm thanh): mỗi đom đóm nhặt được phát một nốt ngũ cung cao dần. Thắp đèn phát hợp âm và một vòng đom đóm xoáy bay lên.

**Bằng chứng phần lõi vẫn đúng:** `git diff` của các thay đổi sáng tạo chỉ chạm vào `src/web/`. Cả 22 test headless vẫn pass ([docs/proof/phase-1/test-output.txt](docs/proof/phase-1/test-output.txt)).

## Cấu trúc

```
src/sim/       simulation + validate (dùng chung)
src/web/       client 3D (Three.js)
src/headless.js
tests/         test contract + scenario riêng (tests/scenarios/)
docs/notes/    giả định, nhật ký AI, đánh giá theo phase
docs/proof/    bằng chứng theo phase
AGENTS.md, .claude/   harness AI (hook, skill)
```
