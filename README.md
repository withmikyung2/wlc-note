# 아하소풍 엔딩노트 WLC 2급 실습판

이 폴더는 기존 `withmikyung2.github.io` 홈페이지와 분리해서 배포하기 위한 독립 사이트 소스임.

## 구성

- `index.html`: 강의 배포용 독립 소개 사이트
- `workbook-ending-note-wlc2.md`: 수강생용 작성 워크북 초안
- `content/ending-note-wlc2-plan.md`: 콘텐츠 구조 기획 문서
- `domain-setup-note-salmitta.md`: 최종 도메인 연결 안내
- `assets/qr-wlc-note-current.png`: 현재 주소 QR코드

## 배포 주소

지금 바로 쓰는 주소:

`https://withmikyung2.github.io/wlc-note/`

강의 배포용 최종 주소:

`https://note.salmitta.net/`

최종 주소는 도메인 관리 화면에서 다음 DNS 설정을 마친 뒤 사용함.

- 종류: `CNAME`
- 이름: `note`
- 값: `withmikyung2.github.io`

DNS 연결 전에는 현재 주소를 사용함.

인쇄물과 수강생 안내에는 현재 주소 QR코드만 사용함.
짧은 도메인 QR코드는 DNS 연결 후 새로 생성함.

## 운영 원칙

- 기존 홈페이지 `https://withmikyung2.github.io/`는 수정하지 않음
- 강의 때 직접 링크를 열어 배포하거나 안내함
- 인쇄물과 현장 안내에는 QR코드를 함께 제공함
- 워크북, PPT, 소개 페이지를 이 독립 사이트 안에서 확장함
