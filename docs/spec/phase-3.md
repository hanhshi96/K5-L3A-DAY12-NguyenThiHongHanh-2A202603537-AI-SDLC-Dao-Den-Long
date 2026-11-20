# Spec Phase 3: Ticket-03 "Đèn cạn dầu" (Contract v1.2)

Quyết định thiết kế: [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md). Thay đổi phá vỡ tương thích: [CHANGELOG.md](../../CHANGELOG.md).

## Giả định (ticket chưa nói rõ)
| # | Giả định |
|---|---|
| H1 | Bóng Mực đi tới đèn yếu với **tốc độ đuổi** (4 / 4.5 m/s). Mục tiêu được giữ cho tới khi đèn hết yếu (tắt, hoặc ≥ 30). |
| H2 | `fuel_drain` phát ở tick hút thứ 60, 120… của từng Bóng Mực (đếm từ lúc vào `drain`). |
| H3 | Bóng Mực ở `drain` không gây sát thương (chỉ `wander` và `chase` mới gây). |
| H4 | Đèn trong scenario có `lit: true` mà không ghi `ever_lit` thì coi là `ever_lit: true`. |
| H5 | "Đầy dầu" nghĩa là fuel = 100 sau bước 2. Vì đèn tự hao ở bước 2, thực tế chỉ đầy ngay trong tick vừa được châm. |
| H6 | Khi thắp lại, `deposited` tính tới `relight_cost` (5). Khi đèn tắt, `deposited` về 0. |
| H7 | Sức chứa giảm không làm mất đom đóm đang mang (sức chứa không bao giờ giảm trong một Đêm). |

## Tiêu chí nghiệm thu → test
| Tiêu chí | Test (`tests/phase3.test.js`) |
|---|---|
| Fuel 100 khi thắp, giảm 1/s chính xác (số nguyên) | `fuel: lit lantern starts…` |
| Hết dầu thì tắt, `lantern_out`, deposited = 0, giữ `ever_lit` | `fuel <= 0…` |
| Châm dầu: số đom đóm dùng, +10 fuel, +5 điểm | `refuel…` |
| Thắp lại cần 5, +40, `relight: true` | `relight…` |
| Sức chứa 10 + 2·n, tối đa 20 | `capacity…` |
| Đèn yếu mất vùng an toàn; trạng thái `drain`; 5/s; `fuel_drain` mỗi 60 tick | `weak lantern…`, `fuel exactly 30…` |
| `drain` → `chase` / `stunned` (+15) / `wander` | `drain -> chase…`, `refuel to >= 30…` |
| Luật thắng `dawn_survived` 3/5, 5/7; hết lửa luôn thua trước | `win:…`, `no flames always loses first…` |
| Không còn thắng sớm | `tests/contract.test.js` `P3: lighting every lantern does not end the night` |
