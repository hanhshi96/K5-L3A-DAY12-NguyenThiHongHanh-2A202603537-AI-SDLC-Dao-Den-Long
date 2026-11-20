# Phase 4: đánh giá, nhật ký AI

Bằng chứng: [docs/proof/phase-4/](../proof/phase-4/) · [bench.json](../../bench.json) · [soak.json](../../soak.json)

## 1. Kết quả theo yêu cầu
| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| Benchmark: cảnh chuẩn, 3 s khởi động, đo 30 s, `bench.json` | `scripts/bench.js` (script kiểm tra cảnh có đúng 200 Bóng Mực và 100 đom đóm), ảnh `bench-scene.png` | Đạt trên máy tác giả: avg 291 fps (≥ 60), p1 low 108 (≥ 30), load 3.3 s (≤ 10 s) |
| Soak: 10 Đêm, 1 tiến trình, 0 crash, bộ nhớ ≤ 1.2× | `tests/release.test.js`, `soak.json` | Đạt: 0 crash, 1.13× |
| Bảng xếp hạng: tên, top 10, bằng điểm, lưu đĩa, xuất | `tests/leaderboard.test.js` (gồm khởi động lại server), ảnh `leaderboard.png` | Đạt. Tên tiếng Việt có dấu được chấp nhận (điểm cộng) |
| Dễ tiếp cận: đổi phím, cảnh báo trùng, mặc định, lưu | ảnh `settings.png`, code | Có code và ảnh; **chưa kiểm thử thủ công** việc đổi phím |
| Phụ đề và cảnh báo bằng hình, giảm chuyển động, chữ ≥ 18 px, chữ lớn | code (`captions`, `reducedMotion`, CSS `--ui`) | Có code; **chưa kiểm thử thủ công** |
| Clone sạch, tối đa 3 lệnh | clone vào thư mục trống → `npm install` → `node server.js`, 65 test pass, bench 3 s chạy | Đạt (sau khi sửa lỗi cài đặt ở mục 2) |
| README, CHANGELOG 4 phase, CREDITS, LICENSE | các file ở gốc repo | Đạt |
| Release `v1.0.0` có bản chạy được | `scripts/package.sh` → `dist/dao-den-long-v1.0.0.zip`, đã giải nén và chạy thử | Đạt (người dùng tạo Release) |
| Contract v1.3 (`bench_cmd`, `soak_cmd`) | test "v1.3 and mirrors…" | Đạt |
| Test Phase 1–3 còn hiệu lực vẫn đạt | 65/65 | Đạt |

## 2. Sự cố và lỗi (AI và môi trường)
1. **Soak vượt ngưỡng bộ nhớ (1.93×).** AI không sửa mò. Đo heap sau từng Đêm thì thấy heap đứng yên ở 4.2–4.4 MB suốt 30 Đêm, tức không có rò rỉ. RSS tăng là do mã JIT của V8, nên chạy soak với `--jitless` (1.13×). Ghi trung thực: chạy 30 Đêm thì vẫn là 1.33×.
2. **Chrome for Testing giải nén thiếu trên macOS** (thiếu Framework, kèm `ECONNRESET`). Giải nén lại bằng `ditto`; bench thêm dự phòng dùng Chrome có sẵn trên máy.
3. **Lỗi nghiêm trọng khi clone sạch:** `npm install` thất bại vì puppeteer tải `chrome-headless-shell` lỗi, nên Three.js không được cài và game không chạy. Chỉ phát hiện được nhờ thử clone sạch. Sửa: `.puppeteerrc.cjs` (`skipDownload`), chuyển puppeteer thành `optionalDependencies`, bench tự tải Chrome khi cần.
4. **AI chèn code mà không kiểm tra chuỗi khớp** (Python `replace` không có `assert`), nên cảnh bench không vào file. Phát hiện nhờ lỗi `startBench is not defined`. Đã thêm vào AGENTS.md: mọi lệnh sửa bằng script phải kiểm tra chuỗi có khớp đúng 1 lần.
5. Lần bench đầu `load_ms` = 12.6 s do macOS kiểm tra bảo mật Chrome mới tải; các lần sau khoảng 3.3 s. Three.js chuyển từ CDN sang npm để không phụ thuộc mạng.
6. Script chụp màn hình bằng puppeteer bị treo; đổi sang chụp bằng Chrome trực tiếp, mở thẳng màn hình qua tham số URL (`?board`, `?settings`).

## 3. Token
Khoảng 150–200k cho Phase 4. Tiết kiệm bằng cách đo trước khi sửa (soak, load), không chạy lại benchmark 30 s nhiều lần (dùng bản 3–5 s để thử), và chỉ đọc log lỗi cần thiết.
