# note.salmitta.net 연결 안내

## 목표 주소

`https://note.salmitta.net/`

## 1단계: 도메인 DNS 설정

도메인 관리 화면에서 다음 레코드를 추가함.

- 종류: `CNAME`
- 이름: `note`
- 값: `withmikyung2.github.io`

## 2단계: GitHub Pages 설정

DNS가 반영된 뒤 GitHub 저장소 설정에서 Custom domain에 다음 값을 입력함.

`note.salmitta.net`

또는 저장소 루트에 `CNAME` 파일을 만들고 아래 한 줄을 넣음.

`note.salmitta.net`

## 3단계: 확인

브라우저에서 다음 주소를 열어 확인함.

`https://note.salmitta.net/`

## 주의

DNS 연결 전에 `CNAME` 파일을 먼저 배포하면 현재 GitHub Pages 주소가 최종 도메인으로 이동하면서 접속이 불안정해질 수 있음.
따라서 현재는 `https://withmikyung2.github.io/wlc-note/`를 사용하고, DNS 연결 후 최종 주소로 전환함.
