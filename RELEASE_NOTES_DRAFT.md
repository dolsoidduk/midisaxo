# Release notes (draft)

## Artifacts
- OpenDeckConfigurator-linux-x64.zip
- OpenDeckConfigurator-win32-x64.zip

## Changes
- UI: SysEx Macros 관련 UI(화면/라우트/버튼 메시지 타입 옵션) 제거
- Firmware(OpenDeck-firmware 포함): 태그 없는 환경에서도 버전 파싱 실패 없이 빌드되도록 처리 + 일부 레이아웃 초기화 안정화
- Firmware(Midisaxo): 피치벤드 센터 캡쳐/전원유지 및 중앙 데드존(민감도) 설정 추가
	- system setting #12: PB deadzone (중앙 민감도)
	- system setting #13: PB center (캡쳐된 센터값)
	- system setting #11: sax transpose (0..48, MSB는 내부 init 플래그로 사용)
- Build: Linux/Windows 오프라인 패키징(make pkg) 경로를 npm 기반으로 정리하여 재현 가능하게 개선

## Notes
- 빌드 시 경고(예: Browserslist caniuse-lite outdated, experimental applyComplexClasses)는 있으나 패키징/빌드는 성공합니다.
