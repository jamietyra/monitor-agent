# monitor-agent

[Claude Code](https://claude.ai/code) 실시간 활동 대시보드. 프롬프트, 도구 호출, 파일 변경, 코드 diff를 실시간으로 확인하세요.

[English](README.md)

<p align="center">
  <img src="preview.ko.svg" alt="monitor-agent 대시보드 미리보기" width="100%">
</p>

## 기능

- **프롬프트 그룹 활동 피드** — 사용자 프롬프트별로 도구 호출이 그룹화되며, 접기/펼치기 + 전체 토글 지원
- **세션 필터 버튼** — 자동 감지된 프로젝트별 색상 필터 (예: main, web-app, api-server)
- **검색 / 필터 바** — 프롬프트, 파일명, 명령어 전체 검색
- **코드 뷰어** — Claude가 파일을 읽거나 수정할 때 구문 강조된 파일 내용 표시. Edit 항목 클릭 시 변경된 줄 하이라이트 + 자동 스크롤
- **Diff 뷰어** — 코드 뷰어 옆에 나란히 표시. 과거 Edit 항목 클릭으로 변경 내용 확인 (빨강 = 삭제, 초록 = 추가)
- **어시스턴트 텍스트 응답** — 초록색 점과 함께 인라인 표시
- **패널 리사이즈** — 피드와 코드 패널 사이 핸들을 드래그하여 레이아웃 조정
- **프롬프트 단위 페이지네이션** — 초기 50개 프롬프트 로드. "Load 20 more prompts" 클릭으로 이전 기록 추가 로드
- **멀티 세션 지원** — 최근 7일간 하위 프로젝트의 모든 transcript 로드
- **즉시 세션 감지** — 디렉토리 워처로 새 Claude Code 세션을 즉시 감지 (60초 폴백 스캔)
- **빠른 재시작** — byte-offset 캐시(`offsets.json`)로 서버 재시작이 거의 즉시 완료
- **원격 접근** — 토큰 인증으로 다른 기기에서 대시보드 접속 가능
- **제로 디펜던시** — 순수 Node.js 내장 모듈만 사용, `npm install` 불필요

## 빠른 시작

```bash
git clone https://github.com/jamietyra/monitor-agent.git
cd monitor-agent
node server.mjs
```

브라우저에서 **http://localhost:3456** 을 열면 됩니다.

### VS Code 팁

VS Code의 Simple Browser를 활용하면 코드와 나란히 볼 수 있습니다:

`Ctrl+Shift+P` → `Simple Browser: Show` → `http://localhost:3456`

### 특정 디렉토리 모니터링

```bash
node server.mjs /path/to/your/project
```

기본적으로 현재 작업 디렉토리를 기준으로 Claude Code 세션을 찾습니다.

## 작동 원리

Claude Code는 모든 활동을 `~/.claude/projects/` 내 transcript JSONL 파일에 기록합니다. monitor-agent가 이 파일과 디렉토리를 실시간 감시하고, 파싱된 이벤트를 Server-Sent Events(SSE)로 브라우저에 스트리밍합니다.

```
Claude Code → transcript.jsonl → monitor-agent (server.mjs) → SSE → 브라우저 대시보드
```

디렉토리 워처로 새 세션을 즉시 감지하며, 60초마다 폴백 스캔을 수행합니다.

## 대시보드 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│  monitor-agent       Running: 2  Done: 847  Errors: 3   │
├──────────────────────────────────────────────────────────┤
│  Feeds                                                   │
│  [검색 (프롬프트, 파일명, 명령어...)]                     │
│  [▶ All] [MAIN] [웹앱] [API서버]                          │
│                                                          │
│  ▼ MAIN 10:30 글씨 크기 10% 키워줘                   [5] │
│    10:30:25 ✓ Read dashboard.html  95ms                  │
│    ● 완료. 목록 전체 크기 10% 커짐.                       │
│  ▶ MAIN 10:15 하단 섹션 제거해줘                      [3] │
│  ▶ API서버 09:45 주문 API 수정해줘                   [12] │
│                                                          │
├─ ─ ─ ─ ─ ─ ─ ─ 드래그로 크기 조절 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│  코드 뷰어                    │  Diff 뷰어               │
│  dashboard.html  1007줄       │  Edit: dashboard.html    │
│  (구문 강조된 코드)            │  - 삭제된 코드 (빨강)     │
│                               │  + 추가된 코드 (초록)     │
├───────────────────────────────┴──────────────────────────┤
│  ● Connected                            Actions: 2,662   │
└──────────────────────────────────────────────────────────┘
```

## 원격 접근

다른 기기에서 대시보드에 접속하려면:

```bash
MONITOR_REMOTE=true MONITOR_TOKEN=your-secret-token node server.mjs
```

접속: `http://서버IP:3456/?token=your-secret-token`

| 환경 변수 | 기본값 | 설명 |
|----------|--------|------|
| `MONITOR_PORT` | `3456` | 서버 포트 |
| `MONITOR_REMOTE` | `false` | 원격 접근 활성화 (`true`로 설정 시 0.0.0.0에서 수신) |
| `MONITOR_TOKEN` | (없음) | 인증 토큰 (원격 접근 시 필수) |

`MONITOR_REMOTE=true` 없이 실행하면 localhost에서만 접속 가능합니다.

## 요구 사항

- Node.js >= 18
- 활성화된 Claude Code 세션

## 라이선스

MIT
