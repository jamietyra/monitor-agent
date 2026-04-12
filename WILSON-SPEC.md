# Wilson — AI Companion Character Spec

> monitor-agent 대시보드 상단 인터랙션 캐릭터 위젯
> Status: **Design Complete / 개발 보류**

---

## 1. 컨셉

캐스트어웨이의 배구공 Wilson처럼, "거기 있는" 느낌의 AI 동반자.
말이 많지 않고, 주로 표정과 움직임으로 개발자의 상태를 반영하는 비언어적 존재.

---

## 2. 기술 결정

| 항목 | 결정 |
|------|------|
| 렌더링 | CSS + SVG (Canvas 아님, 외부 라이브러리 없음) |
| 배치 | 헤더 좌측 — h1 "monitor-agent" 앞 |
| 파일 | `dashboard/wilson.js` + `dashboard/wilson.css` 신규 생성 |
| server.mjs | 수정 없음 — 기존 SSE 이벤트만 활용 |
| 원칙 | zero-dependency, 기존 UI 비침투적 |

---

## 3. 캐릭터 디자인 (SVG)

참고: 캐스트어웨이 Wilson 배구공

- **바탕**: 오프화이트 배구공 (`#f0ebe0`) + 솔기 라인
- **얼굴**: 크림슨 핸드프린트 형태 (`#8B1A1A`) + 손가락 모양 머리카락
- **눈**: 유기적 형태 흰색 path (완벽한 원이 아닌 불규칙 shape) + 어두운 동공 + 하이라이트
- **코**: 작은 흰색 점 (opacity 0.25)
- **입**: 미소 곡선 (opacity 0.35)
- **크기**: 38x38px, viewBox 0 0 48 48

### SVG 구조

```svg
<svg viewBox="0 0 48 48">
  <!-- 배구공 바탕 -->
  <circle cx="24" cy="24" r="22" fill="#f0ebe0" stroke="#d8d0c4" stroke-width="0.8"/>
  <!-- 솔기 -->
  <line x1="3" y1="16" x2="45" y2="16" stroke="#ccc4b8" stroke-width="0.5"/>
  <line x1="3" y1="33" x2="45" y2="33" stroke="#ccc4b8" stroke-width="0.5"/>
  <!-- 핸드프린트 얼굴 -->
  <path class="wilson-face" d="M11 14 C9 9 13 5 17 7 C19 4 22 3 25 5
    C27 3 31 4 33 7 C36 5 40 9 37 14 C41 18 43 24 41 31
    C39 38 33 44 24 44 C15 44 9 38 7 31 C5 24 7 18 11 14 Z" fill="#8B1A1A"/>
  <!-- 왼쪽 눈 (유기적 shape) -->
  <g class="wilson-eye wilson-eye-l">
    <path d="M12 19 Q14 14 19 16 Q22 18 20 23 Q17 26 13 23 Q11 21 12 19 Z"
          fill="white" opacity="0.9"/>
    <circle cx="16" cy="20" r="2" fill="#1a1a2e" class="wilson-pupil"/>
    <circle cx="17.5" cy="18" r="0.8" fill="white" opacity="0.6" class="wilson-shine"/>
  </g>
  <!-- 오른쪽 눈 -->
  <g class="wilson-eye wilson-eye-r">
    <path d="M28 16 Q33 14 36 19 Q37 22 35 24 Q31 27 28 23 Q26 19 28 16 Z"
          fill="white" opacity="0.9"/>
    <circle cx="32" cy="20" r="2" fill="#1a1a2e" class="wilson-pupil"/>
    <circle cx="33.5" cy="18" r="0.8" fill="white" opacity="0.6" class="wilson-shine"/>
  </g>
  <!-- 코 -->
  <circle cx="24" cy="28" r="1" fill="white" opacity="0.25"/>
  <!-- 입 -->
  <path d="M18 35 Q24 39 30 35" fill="none" stroke="white"
        stroke-width="1" opacity="0.35" stroke-linecap="round"/>
</svg>
```

---

## 4. 상태머신

| Wilson 상태 | 트리거 조건 | CSS 애니메이션 |
|------------|-----------|---------------|
| idle | 이벤트 없음 30초+ | 숨쉬듯 scale 변화 (4s 주기) |
| watching | prompt, tool_start 수신 | 고개 기울임 rotate 10deg (2.5s) |
| working | assistant_text, file 변경 | 눈 하이라이트 반짝 (1.8s) |
| focused | 60초 내 prompt 3회+ | 눈동자 빠르게 이동 (1s) |
| surprised | tool_error 수신 | 눈 scale 1.25x (0.4s, 3초 유지) |
| relieved | 에러 후 tool_done 성공 | 부드러운 바운스 (0.8s, 2초 유지) |
| sleepy | 10분+ 무활동 | 눈 scaleY 0.35 + 느린 흔들림 (5s) |

### 전이 규칙

- surprised → 3초 후 자동 → idle
- relieved → 2초 후 자동 → idle
- focused → prompt 빈도 감소 시 → watching → idle
- 모든 이벤트 수신 시 idle/sleep 타이머 리셋

---

## 5. 클릭 인터랙션

- 클릭 시 wobble 애니메이션 (0.5s) + 말풍선 표시
- 말풍선: 개발 팁 100개 중 랜덤 (10% 확률로 "...")
- 말풍선 4초 후 자동 숨김
- 스타일: `var(--bg-panel)` 배경, 위쪽 삼각형 포인터

---

## 6. 구현 순서

1. `wilson.css` — 컨테이너 + SVG 스타일 + 상태별 애니메이션 + 말풍선 + reduced motion
2. `wilson.js` — SVG 생성 + 상태머신 + 타이머 + 팁 100개 + `window.wilson` API 노출
3. `index.html` — 헤더에 `.header-title` 래퍼 + `#wilson-wrap` div + CSS/JS 참조
4. `connection.js` — SSE 이벤트 리스너에 `window.wilson.onEvent(type)` 호출 추가

### 수정 범위

- **신규**: `dashboard/wilson.css`, `dashboard/wilson.js`
- **수정**: `dashboard/index.html` (헤더 구조), `dashboard/connection.js` (이벤트 연결)
- **미수정**: `server.mjs`, `feed.js`, `viewer.js`, `style.css`

---

## 7. 활용 디자인 토큰

```
--bg-panel, --border, --text, --text-xs, --font-mono
--space-sm, --space-md
--ease-out, --duration-normal, --duration-fast
```

---

## 8. 핵심 원칙

- **비침투적**: 기존 UI 깨지지 않게
- **비언어적**: 텍스트 최소화, 표정과 움직임이 주력
- **유기적**: ease-in-out 기반 부드러운 전환
- **self-contained**: wilson.js가 DOM 직접 생성, 외부 의존성 없음
