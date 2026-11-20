# Retro: Đảo Đèn Lồng (Day 12 · AI SDLC)

Người làm: Nguyễn Thị Hồng Hạnh (2A202603537), không có nền tảng lập trình. Làm cùng Claude Code (Opus) trong VS Code. Người học đọc ticket, duyệt kế hoạch, chơi thử, tự commit, gắn tag và push.

## 1. Số liệu
| | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|
| Contract | v1.0 | v1.1 | v1.2 | v1.3 |
| Test (tổng) | 22 | 48 | 59 | 65 |
| Mutation bắt được | 3/3 | 10/11* | 4/4 | 3/3 |
| Lỗi thật trong game do test phát hiện | 1 | 5 | 0 | 2 (cài đặt sạch, bộ nhớ soak) |
| Lỗi trong test do AI viết | 0 | 4 | 1 | 0 |
| Token ước tính | 60–80k | 150–200k | 80–100k | 150–200k |

\* Lỗi còn lại không làm đổi hành vi (hồi chiêu lướt khi đang có bùa).
Tổng token cả dự án khoảng 450–600k. Hiệu năng cuối: avg 322 fps, p1 low 167 fps, load 1.6 s (đo lại sau phần sáng tạo), soak 0 crash và 1.13× bộ nhớ.

## 2. Đánh giá từng phase
- **Phase 1:** đạt toàn bộ Test Contract v1.0. Đúng đắn nhờ một quyết định kiến trúc: **lõi game là JS thuần, dùng chung cho bản 3D và headless**. Người dùng chơi thử thắng 1388 điểm, điểm khớp công thức.
- **Phase 2:** ticket lớn, chỉ có 1 giờ. Viết lại lõi theo 12 bước mỗi tick thay vì vá dần. Kịp tag, nhưng phần giao diện (menu tạm dừng, cài đặt, âm thanh) chưa được chơi thử.
- **Phase 3:** đây là Change Request, nhiều test cũ phải sửa. Mỗi test sửa có ghi chú `// P3:`, test "thắng sớm" được thay hẳn và ghi lý do, có ADR và changelog. Dầu tính bằng số nguyên nên không có sai số.
- **Phase 4:** phần khó là môi trường, không phải luật chơi: Chrome tải lỗi, npm 11 không chạy script cài đặt, RSS do JIT. Thử clone sạch đã cứu bản phát hành khỏi một lỗi cài đặt nghiêm trọng. Cuối phase dành thời gian cho phần sáng tạo (nhân vật Mây mới, trang trí đảo, mũi tên chỉ đom đóm, góc nhìn từ trên xuống), làm từng bước nhỏ, mỗi bước có ảnh chụp kiểm tra.

## 3. Điều hiệu quả và không hiệu quả khi làm với AI
**Hiệu quả**
- Chốt kiến trúc "lõi thuần + headless" ngay từ đầu, nên mọi luật đều test được trong vài giây.
- Bắt AI **viết test theo đúng con số trong ticket**, rồi **kiểm tra mutation** (cố tình làm sai code xem test có đỏ không) để chứng minh test không phải loại "luôn đạt".
- Khi test đỏ, bắt AI **đọc output headless thật** để xác định game sai hay test sai trước khi sửa.
- Chia việc thành các bước nhỏ, mỗi bước một commit do người học tự làm.

**Không hiệu quả**
- Ở Phase 1, AI làm một lượt lớn trước khi người học đặt quy tắc làm việc; về sau mới chuyển sang từng bước.
- Thư mục dự án nằm trong Documents đồng bộ iCloud, nên `git commit` hay bị `Operation timed out`, hai lần làm tag chưa lên được GitHub. Ở Phase 4, iCloud còn đẩy cả file `.git` và `node_modules` lên mây làm `git` và `npm` bị treo; phải chuyển repo sang `~/Projects`.
- Phần giao diện thường bị dồn về cuối phase nên ít được chơi thử. Bằng chứng rõ nhất: dốc Đêm 3 bị vẽ ngược từ Phase 2 tới tận cuối Phase 4 mới phát hiện, vì mọi test chỉ kiểm tra luật, không kiểm tra hình.

## 4. Những lần AI sai và cách phát hiện
| Lỗi | Phát hiện bằng |
|---|---|
| Lệch 1 tick (choáng 179, Gió Lạc 119, đáp đất trễ 1 tick) | test biên thời gian |
| Tích phân trọng lực sai 5% | test đỉnh cú nhảy 1.225 m |
| Kỳ vọng test sai do quên thứ tự bước trong tick (hút dầu trước khi châm) | đọc output headless |
| Snapshot `vel` sai ở tick bục nhảy | test bục nhảy |
| Camera Đêm 3 nằm trong tháp chuông | ảnh chụp |
| Code chèn không vào file (thay chuỗi không kiểm tra) | lỗi trên trang khi chạy bench |
| `npm install` sạch hỏng do puppeteer | thử clone sạch |
| Dốc Đêm 3 vẽ ngược (sai dấu góc nghiêng, từ Phase 2) | người học chơi thử; test headless không bắt được lỗi hiển thị |
| `/?night=N` mất tham số khi chuyển hướng | người học dùng link lúc chuẩn bị quay video |
| Màn hình rung khi đi (60 tick, màn hình 120 Hz) | người học chơi thử, đo quãng đi từng khung hình |
| AI tắt nhầm server người học đang chạy (`pkill`) | trang không mở được |

Không lần nào AI tự sửa test cho "xanh": mỗi lần sửa test đều có lý do và được ghi lại.

## 5. Harness giúp nhiều nhất
1. **Stop hook** (`.claude/hooks/stop-tests.sh`): AI không thể kết thúc khi test còn đỏ. Đã kiểm chứng bằng cách cố tình làm sai code.
2. **AGENTS.md**, được cập nhật sau mỗi phase với mục "Bài học": thứ tự tick, bộ đếm giảm ở bước 2, sai số làm tròn, `quiet()` phải tắt thực thể mặc định, sửa bằng script phải kiểm tra chuỗi khớp.
3. **Skill `contract-check`** và `scripts/proof.sh`: bằng chứng luôn được sinh lại từ code, không sửa tay.
4. **CI GitHub Actions** chạy test mỗi lần push: xác nhận cả 4 tag đều xanh.

## 6. Nếu làm lại
- Đặt quy tắc làm việc (từng bước, người học tự commit) ngay từ phút đầu, và để repo ngoài iCloud.
- Mỗi phase dành 10 phút cuối để **chơi thử thật** và quay một đoạn ngắn, thay vì dồn tới video cuối. Có thể thêm test nhỏ so hình vẽ với luật (ví dụ độ cao hai đầu dốc so với `ground()`).
- Thử clone sạch từ Phase 1, không đợi tới lúc phát hành.
- Ghi số token thật từ công cụ thay vì ước tính.
