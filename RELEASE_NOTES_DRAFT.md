# Release notes (draft)

## Version
- midisaxo-0.1.6 (candidate)

## Artifacts
- (TBD) Midisaxo-0.1.6.AppImage
- (TBD) Midisaxo-0.1.6.tar.gz
- (TBD) midisaxo_pico-0.1.6.uf2
- (TBD) midisaxo_pico-0.1.6.sysex

## Changes
- Firmware(Midisaxo): 자동 비브라토(피치벤드 오버레이) 게이팅 기준을 “센서 #2(피치) + 캡처된 센터(pbCenter)”로 정리
  - gate 판정: pbCenter + threshold 기준
  - sax 모드에서 비브라토 대상 analog index도 빠른 폴링에 포함
- UI: 2x MPXV7002DP(브레스+피치벤드) 구성 및 자동 비브라토(압력 게이트) 설정 절차/도움말 문구 정리
- Dev/Build: 의존성/개발 서버 안정화
  - yarn.lock 파싱 오류 복구 및 package-lock.json 혼용 제거
  - Vue(3.5.x)와 @vue/compiler-sfc 버전 정합성 맞춤 (Vite 경고/에러 방지)
  - Vite v1 호스트/포트 설정 가이드 정리(--hostname 및 VITE_HOST/VITE_PORT)

## Test checklist (when hardware is ready)
- 브레스 센서(#1): CC2/CC11 전송, 곡선/오프셋 동작
- 피치 센서(#2): Pitch Bend 출력, PB Center Capture(캘리브레이션) 동작
- 자동 비브라토: gate threshold에서만 비브라토 오버레이가 켜지는지 확인
- UI 저장/복원: 설정 저장(SysEx) 후 재연결/재부팅 시 동일 동작

## Version
- midisaxo-0.1.4

## Artifacts
- Midisaxo-0.1.4.AppImage (오프라인 스탠드얼론 UI)
- Midisaxo-0.1.4.tar.gz (오프라인 스탠드얼론 UI, portable)

## Changes
- UI(Midisaxo): MIDI Saxophone(핑거링 테이블) 편집 UX 개선
  - 엔트리 표시 가로/세로 전환 + 가로 스크롤/페이지 이동
  - 엔트리별 고급 입력(텍스트/노트) 접기/펼치기(기본 접힘) + 전체 펼치기/접기
  - 비활성(사용/매핑 제외) 상태의 시각적 표시 강화(편집은 가능)
  - “현재 눌림 캡처” 후 같은 엔트리에 유지되어 바로 추가 편집 가능
- UI: 상단 네비게이션에서 MIDI 색소폰 페이지에 항상 진입 가능
- Build/Deploy: GitHub Pages 자동 배포 + 화면 하단 Build 정보 표시(배포 버전 확인)

---

## Version
- midisaxo-0.1.3

## Artifacts
- Midisaxo-0.1.3.AppImage (오프라인 스탠드얼론 UI)
- Midisaxo-0.1.3.tar.gz (오프라인 스탠드얼론 UI, portable)
- midisaxo_pico-0.1.3.uf2 (RP2040 BOOTSEL 드래그&드롭)
- midisaxo_pico-0.1.3.sysex (SysEx 업데이트)

## Changes
- UI: SysEx Macros 관련 UI(화면/라우트/버튼 메시지 타입 옵션) 제거
- Firmware(OpenDeck-firmware 포함): 태그 없는 환경에서도 버전 파싱 실패 없이 빌드되도록 처리 + 일부 레이아웃 초기화 안정화
- Firmware(Midisaxo): 피치벤드 센터 캡쳐/전원유지 및 중앙 데드존(민감도) 설정 추가
  - system setting #12: PB deadzone (중앙 민감도)
  - system setting #13: PB center (캡쳐된 센터값)
  - system setting #11: sax transpose (0..48, MSB는 내부 init 플래그로 사용)
- UI(Midisaxo): Sax 페이지에 CAL 버튼 추가(하드웨어 버튼 없이도 PB Center Capture 실행)
- Firmware(Midisaxo): UI CAL 요청(SysEx custom request 0x60) 처리 추가
- Firmware(Midisaxo): 부팅 웰컴(버전 표시) 화면 최소 3초로 단축
- UI: 오프라인/스탠드얼론 환경에서 업데이트 체크 실패 시 깨지지 않도록 처리
- Build: Linux/Windows 오프라인 패키징(make pkg) 경로를 npm 기반으로 정리하여 재현 가능하게 개선

## Notes
- 빌드 시 경고(예: Browserslist caniuse-lite outdated, experimental applyComplexClasses)는 있으나 패키징/빌드는 성공합니다.
