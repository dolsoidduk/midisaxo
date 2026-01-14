# Release notes (draft)

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
