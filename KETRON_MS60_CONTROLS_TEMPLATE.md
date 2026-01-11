# Ketron MS60 컨트롤 템플릿 (OpenDeck)

이 문서는 OpenDeck 버튼에 Ketron MS60(5핀 DIN MIDI) 컨트롤을 **하드코딩 없이** 매핑하기 위한 “RAW HEX 붙여넣기” 템플릿입니다.

핵심 원칙:
- OpenDeck UI의 버튼 설정에서 **RAW MIDI HEX** 칸에 한 줄로 붙여넣으면,
  - 채널 MIDI(노트/CC/PC), 리얼타임(FA/FC 등), Bank Select+PC, SysEx(F0..F7)를 자동 인식해 저장합니다.
- MS60의 Intro/Variation/Fill/Ending/AutoFill 등은 기종/설정에 따라 **Note/CC/SysEx/MMC 등**으로 나올 수 있어, 실제 HEX는 **캡처로 확정**해야 합니다.

---

## 1) 바로 써볼 수 있는 “표준” 메시지
아래는 대부분 장비에서 공통으로 쓰는 System Real Time 메시지입니다.

- Sync/Start: `FA`
- Sync/Stop: `FC`
- (옵션) Sync/Continue: `FB`

OpenDeck UI (Buttons → Table 또는 Single)에서 해당 버튼의 RAW 칸에 위 HEX를 그대로 입력하면 됩니다.

> 주의: 일부 어레인저는 Start/Stop을 SysEx 또는 CC로만 받는 경우도 있습니다.

---

## 2) MS60 기능 버튼 목록 (HEX 캡처 후 채우기)
아래 표의 HEX 칸은 “캡처한 그대로” 채우세요. (예: `B0 20 00 C0 10` 또는 `F0 ... F7`)

기능 | HEX (캡처값)
---|---
Intro 1 | 
Intro 2 | 
Intro 3 | 
Variation 1 | 
Variation 2 | 
Variation 3 | 
Fill 1 | 
Fill 2 | 
Fill 3 | 
Auto Fill (토글/온) | 
Ending 1 | 
Ending 2 | 
Ending 3 | 
Start | `FA` (우선 시도) 
Stop | `FC` (우선 시도)

---

## 3) HEX 캡처 방법 (장비 확보 후)
장비가 준비되면, 아래 중 하나로 “버튼 누를 때 나가는 MIDI”를 캡처합니다.

### A. PC에서 캡처 (추천)
필요:
- USB-MIDI 인터페이스 (DIN IN/OUT)
- MIDI 모니터 소프트웨어

절차(개요):
1. MS60 MIDI OUT → 인터페이스 MIDI IN
2. 모니터 프로그램에서 해당 포트를 선택
3. MS60에서 원하는 버튼(예: Intro 1)을 누르고, 로그에 찍힌 HEX(또는 바이트 시퀀스)를 복사
4. OpenDeck UI의 RAW HEX 칸에 붙여넣기

### B. OpenDeck에서 “반대로” 보내며 확인
- Start/Stop 같은 표준 메시지는 OpenDeck에서 먼저 보내서 MS60이 반응하는지 확인하기 좋습니다.

---

## 4) SysEx를 쓰게 될 때의 제한/규칙 (중요)
OpenDeck의 Custom SysEx는 저장/전송을 위해 제한이 있습니다.

- 최대 길이: **총 16바이트** (F0, F7 포함)
- payload(=F0와 F7 사이): 최대 **14바이트**
- payload 바이트 값 범위: `00..7F` (7-bit safe)

따라서 MS60에서 캡처한 SysEx가 더 길면:
- 같은 기능이 Note/CC/MMC로도 제공되는지 확인하거나
- 펌웨어 확장(저장 포맷 확장)이 필요할 수 있습니다.

---

## 5) Custom SysEx “변수 바이트 치환” (선택 기능)
OpenDeck 펌웨어는 Custom SysEx 전송 시, 필요하면 특정 위치 바이트를 값으로 치환할 수 있습니다.

- Variable byte index (midiId)
  - `0`이면 치환 꺼짐
  - 인덱스는 **전체 SysEx 기준**입니다. (F0=0, 첫 payload=1)
  - 마지막 바이트(F7)는 치환되지 않도록 보호됩니다.
- Variable value (value)
  - 0..127(7-bit) 범위

예:
- `F0 7D 01 02 03 F7` 에서 `02` 자리에 값을 넣고 싶다면
  - Variable byte index = 3 (F0=0, 7D=1, 01=2, 02=3)

---

## 6) 다음 단계
MS60에서 아래 2개만 먼저 캡처해주시면, 나머지도 패턴 분석으로 빠르게 채울 수 있습니다.
- Intro 1의 HEX 1줄
- Variation 1의 HEX 1줄

캡처 문자열을 그대로 보내주세요(공백/콤마 구분 아무거나 OK).
