# Đảo Đèn Lồng

> Video demo: *(sẽ bổ sung ở Phase 4)*
> Day 12 · AI SDLC Lab · 2A202603537 · Nguyễn Thị Hồng Hạnh · Tài liệu lab gốc: [docs/lab/](docs/lab/)

Game 3D góc nhìn thứ ba (Three.js, chạy trên trình duyệt). Người chơi điều khiển Mây, người giữ đèn đội nón lá có treo một chiếc đèn lồng nhỏ. Mây gom đom đóm để thắp lại 5 Đèn Lồng Lớn của Đảo Bến trước bình minh, đồng thời né hoặc xua Bóng Mực.

## Cài đặt và chạy

Yêu cầu Node.js ≥ 18 và trình duyệt có WebGL. Máy cần có mạng, vì Three.js được tải từ CDN jsdelivr.

```bash
npm install        # không có dependency ngoài, chỉ kiểm tra môi trường
npm start          # mở http://localhost:5173
npm test           # 22 test: Test Contract + scenario riêng
```

Chạy headless theo Test Contract v1.0:

```bash
node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

Lệnh `scripts/proof.sh phase-1` sinh lại toàn bộ bằng chứng vào [docs/proof/phase-1/](docs/proof/phase-1/).

## Điều khiển

| Phím | Hành động |
|---|---|
| `W A S D` / phím mũi tên | Di chuyển theo hướng camera |
| `Space` | Nhảy |
| Kéo chuột, hoặc `Q` / `C` | Xoay camera |
| `E` | Nạp đom đóm vào đèn gần nhất (trong 2.5 m) |
| `F` / `Shift` trái | Tỏa sáng: tốn 2 đom đóm, làm choáng và đẩy lùi Bóng Mực trong bán kính 6 m |
| `Enter` / `R` | Bắt đầu / chơi lại sau khi thắng hoặc thua |

## Luật chơi và cách tính điểm

- Đi qua đom đóm là tự nhặt (bán kính 1.2 m), mang tối đa 10 con.
- Mỗi đèn cần **5 đom đóm**. Có thể nạp nhiều lần. Đèn sáng khi đã nạp đủ.
- Bóng Mực đuổi theo khi Mây ở trong 15 m, ngoài khoảng đó thì lang thang. Bị chạm thì Mây mất 1 lửa (có 3 lửa), rơi 50% số đom đóm đang mang (làm tròn xuống, đom đóm rơi sẽ mất) và được bất tử 1.5 giây.
- Bóng Mực **không vào được vùng 5 m quanh đèn đã thắp** (đèn chưa thắp thì không có tác dụng này).
- Thắng khi thắp đủ 5 đèn. Thua khi hết lửa hoặc hết 300 giây (bình minh).

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực bị choáng bởi một lần tỏa sáng | +25 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng: mỗi lửa còn lại | +50 |

Thua thì không có điểm thưởng cuối màn.

## Test Contract

- Tệp [game.contract.json](game.contract.json) được sinh từ `TUNING` trong [src/sim/sim.js](src/sim/sim.js). Test `tuning mirrors…` kiểm tra hai bên giống hệt nhau.
- `fall_enabled: false`: mép đảo là tường chắn, không thể rơi xuống, nên không bao giờ có sự kiện `player_hit` với `by: "fall"`.
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
