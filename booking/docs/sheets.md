# 예약 스프레드시트 구조

`apps-script/Code.gs`의 `setup()`을 실행하면 아래 4개 시트가 자동으로 만들어집니다.
열 이름(1행)은 코드가 읽는 이름이므로 **바꾸거나 순서를 옮기지 마세요.** 오른쪽에 열을 새로 붙이는 것은 괜찮습니다.

## Services — 서비스 목록

| 열 | 예시 | 설명 |
|---|---|---|
| service_id | `coach-wl` | 영문·숫자·하이픈. 한 번 정하면 바꾸지 않습니다 |
| active | `Y` | `Y`인 서비스만 사이트에 보입니다 |
| sort | `2` | 보이는 순서 (작은 숫자가 먼저) |
| type | `slot` / `request` | `slot` = 열어 둔 시간 중 선택, `request` = 희망일 3개를 받는 의뢰서 |
| category_ko / category_en | 코칭 / Coaching | 카드 위 작은 표시 |
| name_ko / name_en | 웰다잉라이프 1:1 코칭 | 서비스 이름 |
| duration_ko / duration_en | 60분 | 소요시간 |
| mode_ko / mode_en | 온라인 / 대면 | 진행 방식 |
| price_ko / price_en | 상담 후 안내 | 비용 (자유롭게 적습니다. 예: `1회 50,000원`) |
| summary_ko / summary_en | 한두 문장 | 카드 설명 |
| detail_ko / detail_en | `대상: …` 줄바꿈 `내용: …` | 서비스 안내 페이지에 한 줄씩 보입니다 (셀 안 줄바꿈: Ctrl+Enter) |

## Slots — 예약 가능한 시간 (`slot` 서비스용)

| 열 | 예시 | 설명 |
|---|---|---|
| slot_id | `coach-wl-20261103-1000` | 겹치지 않는 이름. `addWeeklySlots()`가 자동으로 만듭니다 |
| service_id | `coach-wl` | Services의 service_id |
| date | `2026-11-03` | 반드시 `YYYY-MM-DD` 텍스트 |
| start / end | `10:00` / `11:00` | `HH:MM` 텍스트 |
| capacity | `1` | 한 시간에 받을 수 있는 인원 |
| booked | `0` | 예약될 때마다 자동으로 1씩 늘고, 취소하면 1 줄어듭니다 |
| open | `Y` | `N`으로 바꾸면 그 시간을 숨깁니다 |

## Bookings — 예약 기록 (자동 입력)

신청이 들어오면 한 줄씩 자동으로 쌓입니다. 운영자는 **status, admin_memo** 열만 고치면 됩니다.
의뢰서형은 확정 전에 **date, time** 칸에 확정 일정을 적어 두면 캘린더에 들어갑니다.

| 열 | 설명 |
|---|---|
| booking_id | 예약번호 `WS-YYYYMMDD-NNN` |
| created_at / updated_at | 신청 시각 / 마지막 상태 변경 시각 |
| status | `접수` → `확정` / `변경요청` / `취소` (목록에서 고릅니다) |
| service_id, service_name | 서비스 |
| slot_id, date, time | 시간 선택형의 일정 (의뢰서형은 운영자가 확정 일정을 적습니다. 예: `2026-11-20`, `14:00–16:00`) |
| pref_dates, pref_time, headcount, venue, topic | 의뢰서형 입력 내용 |
| name, phone, email, org, message | 신청자 정보 |
| consent, lang | 개인정보 동의(Y), 신청 언어(ko/en) |
| admin_memo | 상태 변경 메일 끝에 "안내:"로 붙는 문장 (예: 줌 링크, 장소 안내) |
| calendar_event_id | 확정 시 자동 기록. 지우지 마세요 |

## Settings — 운영 설정

| key | 기본값 | 설명 |
|---|---|---|
| ADMIN_EMAIL | (비어 있음) | **꼭 입력.** 새 예약 알림을 받을 주소 |
| SITE_NAME | with.study 예약센터 | 메일에 쓰는 이름 |
| SITE_URL | https://booking.with.study/ | 메일 속 조회 링크 주소 |
| CALENDAR_ID | (비어 있음) | 비우면 기본 Google 캘린더 |
| RETENTION_DAYS | 365 | 보관 기간. 지난 기록은 매일 새벽 3시에 자동 삭제 |
| REQUEST_DEFAULT_HOURS | 2 | 의뢰서형에 끝 시간이 없을 때 캘린더 길이 |
| MIN_LEAD_DAYS | 1 | 1 = 내일 시간부터 예약 가능 |
| MAX_DAYS_AHEAD | 60 | 앞으로 60일 안의 시간만 보여 줌 |
