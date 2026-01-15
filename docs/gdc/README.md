# Geometry Cannon Defense (GDC)

자동 조준/자동 발사 기반의 생존형 디펜스 프로토타입입니다.

## 실행
- 실행 URL: /gdc/
- 폴더 안의 `index.html`을 브라우저로 열면 실행됩니다.
- 더 편하게 하려면 로컬 서버(예: VSCode Live Server, `python -m http.server`)로 열어도 됩니다.

## 플레이 방법
- 자동 조준/자동 발사로 진행됩니다.
- 스테이지 선택과 업그레이드는 화면 UI 버튼을 사용합니다.

## 저장
- primary: `gdc:save`
- meta upgrades: `gdc:metaUpgrades`
- legacy migration: `GEO_DEFENSE_V37_1` (있으면 자동 이전)

## 개발 규칙
- 모바일 세로 기준
- HUB 버튼은 `../`
- 변경 시 버전 올릴 것
