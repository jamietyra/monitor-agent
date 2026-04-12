# monitor-agent

> **🏐 Claude라는 무인도에서, Wilson이 당신의 곁을 지킵니다.**

[English](README.md)

<p align="center">
  <img src="preview.ko.svg?v=3" alt="monitor-agent 대시보드 미리보기" width="100%">
</p>

---

## 🏝️ 스토리

무인도에 표류한 톰 행크스. 말벗도, 동료도, 통신도 없었다.
그에게 유일한 친구는 해변에서 주운 배구공에 손바닥 자국으로 얼굴을 그린 **Wilson**이었다.

Claude Code로 개발하는 당신도 비슷한 처지다.
AI가 수십 개의 파일을 읽고, 고치고, 명령을 실행한다.
근데 지금 뭘 하고 있는지, 왜 그러는지, 정말 제대로 하고 있는지 — **보이지 않는다**.

**monitor-agent의 Wilson**은 그 무인도에서 당신의 곁을 지키는 시각화 에이전트다.
배구공 캐릭터 Wilson이 AI의 상태를 표정으로 알려주고, 무엇을 읽고 썼는지, 어떤 오류가 났는지, 얼마나 일했는지 — 한눈에 보여준다.

---

## 🙋‍♂️ 왜 만들었나

솔직히 말하면, **코딩을 거의 모르는 초보 개발자**가 만들었다.

AI가 코드를 짜주는 건 기적 같지만, 나는 **AI가 정확히 뭘 하고 있는지** 눈으로 확인하고 싶었다.

- 어떤 파일을 읽었지?
- 뭘 고쳤지? 왜 고쳤지?
- 지금 실행되는 Bash 명령어는 뭐지?
- 에러가 났나? 지금 어떻게 해결 중이지?

이 궁금증이 monitor-agent를 만든 출발점이었다.
**"믿지만, 눈으로 보고 싶다"** — 그게 전부다.

---

## ✨ 기능

### 🏐 Wilson — 시각화 에이전트 캐릭터

배구공 얼굴의 Wilson이 AI 상태를 **5가지 표정**으로 보여줍니다.

| 상태 | 표현 | 의미 |
|------|------|------|
| `waiting` | 천천히 숨쉬기 | 아무 일도 안 일어남 |
| `thinking` | 눈동자 굴림 + 약한 흔들림 | 프롬프트/도구 시작 |
| `working` | 공이 자전 (Y축 회전, 뒷면은 무지) | 도구 완료, 결과 정리 중 |
| `solving` | 황금 오로라 + crimson 펄스 | **에러 발생 — 해결 중** |
| `sleeping` | 눈 감고 숨쉬기 | 10분 무활동 |

### 📂 Recent Files

최근 Read/Write/Edit 된 파일 목록을 시간순으로 보여줍니다.
클릭하면 코드 뷰어에 파일 내용이, Edit이면 변경된 줄이 하이라이트됩니다.

### 📡 실시간 피드 (Feeds)

모든 프롬프트, 도구 호출, 응답이 접이식 그룹으로 쌓입니다.
검색, 세션 필터 지원.

### 👀 코드 + Diff 뷰어

파일 내용(PrismJS 구문 하이라이트)과 변경 내역을 나란히 봅니다.
**Bash/Glob 출력도** 클릭하면 뷰어에 표시됩니다.

### 🎨 3가지 테마

- **Beige** (기본) — 아날로그 느낌의 따뜻한 종이 색
- **White** — 깔끔한 라이트
- **Dark** — 개발자 클래식

헤더 우측 [Beige] 버튼 클릭으로 순환. `localStorage`에 저장됩니다.

### 🎛️ 패널 토글

헤더의 `Wilson` / `File` / `Feed` / `Diff` 버튼으로 각 영역을 개별 on/off. 현재 작업에 필요한 것만 띄워놓을 수 있습니다.

### 🌍 멀티 세션 + 원격 접근

모든 하위 프로젝트의 Claude Code 세션을 동시 모니터링. 토큰 인증으로 외부 기기에서도 접속 가능.

---

## 🚀 빠른 시작

```bash
git clone https://github.com/jamietyra/monitor-agent.git
cd monitor-agent
node server.mjs
```

브라우저에서 **http://localhost:3141** 을 열면 됩니다. (포트는 π에서 따온 `3141`)

### IDE 팁

IDE 안에서 코드와 대시보드를 나란히 띄우는 방법:

- **VS Code / Cursor / Windsurf** (VS Code 계열):
  `Ctrl+Shift+P` → `Simple Browser: Show` → `http://localhost:3141`
- **JetBrains 계열** (IntelliJ IDEA, WebStorm, PyCharm 등):
  Tools → Web Browsers → 외부 브라우저 단축키 지정, 또는 우측 분할 패널에 브라우저 창 배치
- **Zed / Helix / opencode** 등 터미널 기반 에디터:
  브라우저를 창 나란히 배치 — Windows는 `Win + ←/→` 스냅, macOS는 Rectangle/Spectacle, Linux는 타일링 WM 활용
- **듀얼 모니터** 사용 시: 보조 모니터에 대시보드만 띄워두면 가장 편합니다

### 특정 디렉토리 모니터링

```bash
node server.mjs /path/to/your/project
```

기본값은 현재 작업 디렉토리입니다.

---

## ⚙️ 작동 원리

Claude Code는 모든 활동을 `~/.claude/projects/` 안의 transcript JSONL 파일에 기록합니다.
monitor-agent는 이 파일들을 실시간 감시하고, 파싱된 이벤트를 **Server-Sent Events (SSE)**로 브라우저에 스트리밍합니다.

```
Claude Code → transcript.jsonl → monitor-agent (server.mjs) → SSE → 브라우저 대시보드
                                                                   │
                                                                   └─► Wilson (5 states)
                                                                   └─► Feeds
                                                                   └─► Recent Files
                                                                   └─► Code/Diff
```

디렉토리 워처로 새 세션을 즉시 감지하며, 60초마다 폴백 스캔을 수행합니다.

---

## 🖥️ 대시보드 레이아웃

```
┌──────────────────────────────────────────────────────────────────────┐
│ monitor-agent   [Wilson][File][Feed][Diff] [Beige]   Running:2 Done:... │
├───────────────┬──────────────────────────────────────────────────────┤
│               │ Feeds                                                │
│   thinking... │ [검색...]                                             │
│               │ [▶ All] [MAIN] [webapp]                               │
│    🏐          │                                                      │
│   (120x120)   │ ▼ 10:30  글씨 크기 10% 키워줘                   [5]   │
│               │   ✓ Read dashboard.html  95ms                         │
│               │   ● 완료. 목록 전체 크기 10% 커짐.                     │
│   [말풍선]     │                                                      │
│               ├──────────────────────┬───────────────────────────────┤
├───────────────┤ 코드 뷰어              │ Diff 뷰어                     │
│ Recent Files  │ dashboard.html 1007줄 │ Edit: dashboard.html          │
│  ◇ server.mjs │ (PrismJS 하이라이트)  │ - 삭제된 코드 (빨강)           │
│  ✎ style.css  │                      │ + 추가된 코드 (초록)           │
│  + wilson.js  │                      │                               │
├───────────────┴──────────────────────┴───────────────────────────────┤
│ ● Connected                                        Actions: 2,662    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🌐 원격 접근

다른 기기에서 대시보드에 접속하려면:

```bash
MONITOR_REMOTE=true MONITOR_TOKEN=your-secret-token node server.mjs
```

접속: `http://서버IP:3141/?token=your-secret-token`

| 환경 변수 | 기본값 | 설명 |
|----------|--------|------|
| `MONITOR_PORT` | `3141` | 서버 포트 |
| `MONITOR_REMOTE` | `false` | 원격 접근 활성화 (`true`로 설정 시 0.0.0.0에서 수신) |
| `MONITOR_TOKEN` | (없음) | 인증 토큰 (원격 접근 시 필수) |

`MONITOR_REMOTE=true` 없이 실행하면 localhost에서만 접속 가능합니다.

---

## 📦 요구 사항

- Node.js >= 18 (권장: 22+)
- 활성 Claude Code 세션
- 의존성 없음 (`npm install` 불필요)

---

## 📝 라이선스

MIT

---

## 💬 Credits

- 캐릭터 영감: 영화 **Cast Away (2000)** — Tom Hanks와 배구공 Wilson
- 폰트: [Fraunces](https://fonts.google.com/specimen/Fraunces) (제목/섹션), [Caveat](https://fonts.google.com/specimen/Caveat) (Wilson 상태)
- 코드 하이라이트: [PrismJS](https://prismjs.com/)
- 테마 영감: VSCode, 그리고 아날로그 노트
