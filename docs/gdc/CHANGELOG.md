# Changelog - Geometry Cannon Defense (GDC)

버전 규칙:
- 버전은 반드시 패치마다 증가한다.
- 표기 위치: (1) 페이지 타이틀 또는 화면 내 버전 텍스트 (2) CHANGELOG
- 기록 형식: YYYY-MM-DD

## Unreleased
### Added
-
### Changed
-
### Fixed
-
### Removed
-

## v1.0.3 - 2026-01-16
### Changed
- 메타 업그레이드 최대 레벨 99로 확장
- 메타 업그레이드 비용 상승폭 증가
### Added
- 메타 업그레이드 리셋 시 자원(파편/코어) 전액 환불
- 기존 저장 데이터용 환불 마이그레이션(구버전 구매 비용 계산)

## v1.0.2 - 2026-01-18
### Fixed
- 레벨업 카드: 미설치 특수무기 업그레이드 카드가 등장하던 문제 수정(활성 무기만 노출)
### Added
- 메인화면: 메타 업그레이드 리셋(2중 확인)

## v1.0.1 - 2026-01-17
### Changed
- Refactor: UI/모달/DEV/설정 모듈 분리(동작 동일)

## v1.0.0 - 2026-01-16
### Changed
- 허브/GAMES.json/게임 내 버전 표기 v1.0.0으로 리셋 및 동기화
### Fixed
- gdc 로비 무반응 원인 수정(정적 main.js 로딩 + DOMContentLoaded 부트 가드)
- 게임오버 재도전 버튼 버그 수정(isTestStage 전역참조 제거)

## v37.4.1 - 2026-01-15
### Fixed
- v37.4.0 로딩 실패(로비 버튼 무반응) 복구
- 누락된 모듈 파일(dom/modals/devTools/metaUpgradesUi/fx) 추가

## v37.4.0 - 2026-01-15
### Added
- FX: 파티클/데미지 숫자/피격 플래시/화면 흔들림/피격 비네트
- 설정 토글: 화면 흔들림, 데미지 숫자(로컬 저장)
### Improved
- 전투 가독성/타격감(게임 느낌 강화)

## v37.3.0 - 2026-01-15
### Added
-
### Changed
- Refactor: split UI/dev/meta modules
### Fixed
-
### Removed
-

## v37.2.2 - 2026-01-15
### Added
- 버전 기반 main.js 부트스트랩 로더로 캐시 영향 완화
### Changed
- DEV/TEST 패널 오버레이를 game-container 기준 absolute로 고정해 모바일 클릭 관통 대응
- DEV 패널 활성화 조건을 URL/로컬스토리지 플래그 기반으로 개선
### Fixed
- DEV/TEST/UPGR 모달이 열려 있는 동안 로비/인게임 클릭이 통과되지 않도록 UI 락 추가
- UPGR 모달 호출 안정화를 위해 글로벌 핸들러/경고 로그 추가

## v37.2.1 - 2026-01-07
### Fixed
- DEV 패널 오픈 시 하단 UI(UPGR 등) 클릭이 관통되던 문제(pointer-events/backdrop)
- GOD MODE / TEST STAGE 버튼이 동작하지 않던 문제(이벤트 연결/함수 적용 지점)
### Added
- TEST MODE: 특수 무기 선택 패널 + 다음 전투 시작 시 선택 무기 강제 적용(테스트용)

## v37.2.0 - 2026-01-07
### Added
- UPGR(영구 업그레이드) 모달: 파편/코어로 구매, 저장, 런 시작 시 자동 적용
- 세로 안내 오버레이에 “계속 진행” 버튼
### Fixed
- Desktop/Notebook에서 세로 안내 오버레이가 입력을 막던 문제(모바일에서만 표시)
- DEV 패널 버튼(GOD MODE/TEST STAGE) 클릭 미동작 문제
- 로비 UPGR 버튼 클릭 불가 문제
### Changed
- 안내 문구: “게임화면에 맞게 세로로 창을 조절해 주세요”
- START 버튼 글씨 크기/자간 소폭 축소(모바일 가독성)

## v37.1.3 - 2026-01-07
### Added
-
### Changed
- START 버튼 글씨 크기/자간 조정(모바일 가독성 개선)
### Fixed
- DEV 패널(버전 5회 탭) 토글 복구
### Removed
-

## v37.1.2 - 2026-01-08
### Added
-
### Changed
- UI polish(로비 정렬/여백/버튼 통일)
- Dev 버튼 숨김 패널 이동
- 모바일 safe-area/하단바 레이아웃 안정화
### Fixed
-
### Removed
-

## v37.1.1 - 2026-01-07
### Added
- 분리된 src 모듈 구조와 버전/스토리지 설정 파일 추가.
### Changed
- localStorage 키를 gdc prefix로 통일하고 기존 저장 데이터를 자동 마이그레이션.
### Fixed
- 모바일 세로 뷰포트/세이프 에어리어 및 캔버스 리사이즈 안정화.
### Removed
-
