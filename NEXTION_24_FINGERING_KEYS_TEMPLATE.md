# Nextion 24키(색소폰 핑거링) 버튼 템플릿

이 문서는 Nextion HMI에서 **24개 버튼을 색소폰 핑거링 24키**로 사용하기 위한 템플릿입니다.

펌웨어(현재 midisaxo2/OpenDeck-firmware)는 Nextion에서 들어오는 터치 이벤트를 다음처럼 해석합니다.

- 프레임 헤더: `0x65`
- 2번째 바이트: `state` (눌림/뗌)
- 3번째 바이트: `index` (버튼 인덱스)
- 종료 바이트: `0xFF 0xFF 0xFF`

그리고 sax fingering 마스크는 이렇게 매핑됩니다.

- **Nextion index 0..23 → sax key 0..23**
- 즉, “버튼 1~24”를 만들면 **버튼번호-1**을 index로 보내면 됩니다.

---

## 1) 버튼 공통 규칙

각 버튼의 이벤트에 아래를 넣습니다.

- Touch Press Event (눌림):

```text
printh 65 01 XX FF FF FF
```

- Touch Release Event (뗌):

```text
printh 65 00 XX FF FF FF
```

여기서 `XX`는 index(0~23)를 **16진수 2자리**로 넣습니다.

> 참고: 일부 Nextion 환경에서는 공백 없이(`6501XXFFFFFF`)도 동작하지만,
> 호환성을 위해 위처럼 **바이트 사이에 공백을 넣는 표기**를 권장합니다.
>
> 또한 Nextion은 핫스팟/버튼을 만들었다고 자동으로 이 이벤트를 보내지 않습니다.
> 반드시 각 오브젝트의 Touch Press/Release 이벤트에 `printh ...`를 직접 넣어야 합니다.

---

## 2) 인덱스 매핑표 (버튼번호 → XX)

| 버튼번호 | index(10진) | XX(16진 2자리) |
|---:|---:|:---|
| 1 | 0 | 00 |
| 2 | 1 | 01 |
| 3 | 2 | 02 |
| 4 | 3 | 03 |
| 5 | 4 | 04 |
| 6 | 5 | 05 |
| 7 | 6 | 06 |
| 8 | 7 | 07 |
| 9 | 8 | 08 |
| 10 | 9 | 09 |
| 11 | 10 | 0A |
| 12 | 11 | 0B |
| 13 | 12 | 0C |
| 14 | 13 | 0D |
| 15 | 14 | 0E |
| 16 | 15 | 0F |
| 17 | 16 | 10 |
| 18 | 17 | 11 |
| 19 | 18 | 12 |
| 20 | 19 | 13 |
| 21 | 20 | 14 |
| 22 | 21 | 15 |
| 23 | 22 | 16 |
| 24 | 23 | 17 |

---

## 3) 24개 버튼용 복붙 리스트

아래는 버튼 1~24에 대해, 각각 Press/Release에 넣을 문자열을 그대로 적어둔 것입니다.

### 버튼 1 (index 00)
- Press: `printh 65 01 00 FF FF FF`
- Release: `printh 65 00 00 FF FF FF`

### 버튼 2 (index 01)
- Press: `printh 65 01 01 FF FF FF`
- Release: `printh 65 00 01 FF FF FF`

### 버튼 3 (index 02)
- Press: `printh 65 01 02 FF FF FF`
- Release: `printh 65 00 02 FF FF FF`

### 버튼 4 (index 03)
- Press: `printh 65 01 03 FF FF FF`
- Release: `printh 65 00 03 FF FF FF`

### 버튼 5 (index 04)
- Press: `printh 65 01 04 FF FF FF`
- Release: `printh 65 00 04 FF FF FF`

### 버튼 6 (index 05)
- Press: `printh 65 01 05 FF FF FF`
- Release: `printh 65 00 05 FF FF FF`

### 버튼 7 (index 06)
- Press: `printh 65 01 06 FF FF FF`
- Release: `printh 65 00 06 FF FF FF`

### 버튼 8 (index 07)
- Press: `printh 65 01 07 FF FF FF`
- Release: `printh 65 00 07 FF FF FF`

### 버튼 9 (index 08)
- Press: `printh 65 01 08 FF FF FF`
- Release: `printh 65 00 08 FF FF FF`

### 버튼 10 (index 09)
- Press: `printh 65 01 09 FF FF FF`
- Release: `printh 65 00 09 FF FF FF`

### 버튼 11 (index 0A)
- Press: `printh 65 01 0A FF FF FF`
- Release: `printh 65 00 0A FF FF FF`

### 버튼 12 (index 0B)
- Press: `printh 65 01 0B FF FF FF`
- Release: `printh 65 00 0B FF FF FF`

### 버튼 13 (index 0C)
- Press: `printh 65 01 0C FF FF FF`
- Release: `printh 65 00 0C FF FF FF`

### 버튼 14 (index 0D)
- Press: `printh 65 01 0D FF FF FF`
- Release: `printh 65 00 0D FF FF FF`

### 버튼 15 (index 0E)
- Press: `printh 65 01 0E FF FF FF`
- Release: `printh 65 00 0E FF FF FF`

### 버튼 16 (index 0F)
- Press: `printh 65 01 0F FF FF FF`
- Release: `printh 65 00 0F FF FF FF`

### 버튼 17 (index 10)
- Press: `printh 65 01 10 FF FF FF`
- Release: `printh 65 00 10 FF FF FF`

### 버튼 18 (index 11)
- Press: `printh 65 01 11 FF FF FF`
- Release: `printh 65 00 11 FF FF FF`

### 버튼 19 (index 12)
- Press: `printh 65 01 12 FF FF FF`
- Release: `printh 65 00 12 FF FF FF`

### 버튼 20 (index 13)
- Press: `printh 65 01 13 FF FF FF`
- Release: `printh 65 00 13 FF FF FF`

### 버튼 21 (index 14)
- Press: `printh 65 01 14 FF FF FF`
- Release: `printh 65 00 14 FF FF FF`

### 버튼 22 (index 15)
- Press: `printh 65 01 15 FF FF FF`
- Release: `printh 65 00 15 FF FF FF`

### 버튼 23 (index 16)
- Press: `printh 65 01 16 FF FF FF`
- Release: `printh 65 00 16 FF FF FF`

### 버튼 24 (index 17)
- Press: `printh 65 01 17 FF FF FF`
- Release: `printh 65 00 17 FF FF FF`

---

## 4) 주의사항

- Nextion에서 버튼의 Touch Release가 제대로 안 나오는 구성(페이지 전환/오브젝트 숨김 등)이면 “뗌” 이벤트가 누락될 수 있습니다. 그 경우 화면 전환 전에 강제로 Release를 쏘는 방식으로 보완해야 합니다.
- 펌웨어는 현재 **index=0..23만** sax mask로 사용합니다. 24개를 넘는 버튼은 다른 용도로는 쓸 수 있지만, sax mask에는 반영되지 않습니다.
