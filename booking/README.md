# with.study 예약센터 (booking.with.study)

강의 의뢰, 1:1 코칭, 기업 컨설팅, 교육과정 신청을 한 곳에서 받고, 운영자가 확인한 뒤 확정하는 예약 사이트입니다.
서버 없이 **GitHub Pages(화면) + Google Apps Script·Sheets(저장·메일·캘린더)** 로 운영합니다.

이 폴더는 기존 `wlc-note` 사이트와 별개의 독립 프로젝트입니다. 기존 폴더/파일은 수정하지 않았습니다.

## 구성

- `index.html` — 사이트 전체 (홈, 서비스, 예약하기 4단계, 예약 조회, 소개, FAQ, 개인정보 처리방침). 한국어/영어, 다크모드 지원
- `apps-script/Code.gs` — 예약 저장, 시간대 조회, 중복 차단, 메일 발송, 캘린더 등록, 보관기간 자동 삭제
- `apps-script/appsscript.json` — Apps Script 설정 (서울 시간대, 웹앱 공개 설정)
- `docs/sheets.md` — 스프레드시트 4개 시트의 열 구조
- `docs/operator-manual.md` — 운영자 매뉴얼 (확정·취소·시간 열기)

## 지금 상태: 체험 모드

`index.html` 안의 `CONFIG.API_URL`이 비어 있으면 **체험 모드**로 열립니다.
상단에 "준비 중" 안내가 보이고, 예시 서비스·시간으로 예약 과정을 끝까지 눌러 볼 수 있지만 아무 데도 전송되지 않습니다.
`https://withmikyung2.github.io/wlc-note/booking/`에서 바로 확인할 수 있습니다.

## 실제 운영 연결 (약 20분)

1. **스프레드시트 만들기:** Google Drive에서 새 스프레드시트를 만들고 이름을 `with.study 예약`으로 정합니다. (공유하지 않습니다)
2. **스크립트 붙이기:** 확장 프로그램 → Apps Script → `Code.gs` 내용을 통째로 붙여 넣습니다.
   프로젝트 설정에서 "appsscript.json 표시"를 켜고 `appsscript.json`도 붙여 넣습니다.
3. **처음 설정:** 편집기 위쪽에서 함수 `setup` 선택 → 실행 → 권한 허용.
   시트 4개와 예시 서비스 5개가 만들어집니다.
4. **Settings 시트**에서 `ADMIN_EMAIL`에 운영자 이메일을 적습니다.
5. **트리거 설치:** 함수 `installTriggers` 실행 (상태 변경 메일 + 매일 보관기간 정리)
6. **시간 열기:** 함수 `exampleAddSlots` 실행 (요일·시간은 코드에서 고쳐서 씁니다)
7. **웹앱 배포:** 배포 → 새 배포 → 유형 "웹 앱" → 실행: 나 / 액세스: 모든 사용자 → 배포 → **웹 앱 URL 복사**
8. **사이트 연결:** `index.html`의 `CONFIG.API_URL: ''` 따옴표 안에 URL을 붙여 넣고 커밋합니다.
   상단 "준비 중" 안내가 사라지면 연결된 것입니다.

> 코드를 고친 뒤에는 배포 → 배포 관리 → 수정(연필) → 버전 "새 버전"으로 다시 배포해야 반영됩니다. URL은 그대로입니다.

## booking.with.study 주소 연결

GitHub Pages는 저장소 하나에 사용자 도메인 하나만 연결됩니다. 이 저장소는 이미 `note.salmitta.net`용이므로,
`booking.with.study`는 **새 저장소**(예: `withmikyung2/booking`)로 옮겨서 연결합니다.

1. 새 저장소를 만들고 이 폴더의 파일을 저장소 최상위에 올립니다. (`index.html`이 맨 위에 오도록)
2. 저장소 최상위에 `CNAME` 파일을 만들고 내용에 `booking.with.study` 한 줄만 적습니다.
3. Settings → Pages → Branch `main` / `(root)` → Save
4. with.study 도메인 관리 화면에서 DNS 추가
   - 종류: `CNAME` / 이름: `booking` / 값: `withmikyung2.github.io`
5. 연결되면 Pages 화면에서 "Enforce HTTPS"를 켭니다.

## 운영 원칙

- 화면(GitHub, 공개)과 개인정보(Google Sheets, 비공개)를 분리합니다. 신청자 정보는 저장소에 올리지 않습니다.
- 자동 확정하지 않습니다. 모든 예약은 "접수" → 운영자 확인 → "확정" 순서입니다.
- 같은 시간 중복 예약은 서버에서 잠금(LockService)으로 막습니다.
- 수집 항목은 이름·연락처·이메일·소속·요청사항으로 제한하고, 1년 뒤 자동 삭제합니다.
- 예약 조회는 예약번호 + 연락처 뒷자리 4개로만 하고, 상태·일정만 보여 줍니다 (이름·연락처는 보여 주지 않음).

## 바꿔야 할 곳

- 서비스 이름·비용·설명 → Services 시트 (체험 모드 문구는 `index.html`의 `DEMO_SERVICES`)
- 문의 이메일 → `index.html`의 `CONFIG.CONTACT_EMAIL`
- 운영자 소개 문구 → `index.html`의 "소개" 영역
- 취소·변경 규정 → 각 서비스의 `detail_ko` 마지막 줄
