# monitor-agent

[Claude Code](https://claude.ai/code) 실시간 활동 대시보드. 프롬프트, 도구 호출, 파일 변경, 코드 diff를 실시간으로 확인하세요.

[English](README.md)

<p align="center">
  <img src="preview.svg" alt="monitor-agent 대시보드 미리보기" width="100%">
</p>

## 기능

- **프롬프트 그룹 활동 피드** — 사용자 프롬프트별로 도구 호출이 그룹화되며, 접기/펼치기 가능
- **세션 필터 버튼** — 자동 감지된 프로젝트별 색상 필터 (예: IT, TYDEV, TYINT)
- **검색 / 필터 바** — 프롬프트, 파일명, 명령어 전체 검색
- **코드 뷰어** — Claude가 파일을 읽거나 수정할 때 구문 강조된 파일 내용 표시
- **Diff 뷰어** — 과거 Edit 항목을 클릭하면 변경 내용 확인 (빨강 = 삭제, 초록 = 추가)
- **어시스턴트 텍스트 응답** — 초록색 점과 함께 인라인 표시
- **패널 리사이즈** — 패널 사이 핸들을 드래그하여 레이아웃 조정
- **멀티 세션 지원** — 최근 7일간 하위 프로젝트의 모든 transcript 로드
- **25,555 이벤트 보관** — 메모리에 최근 이벤트 롤링 윈도우 유지
- **자동 세션 감지** — 10초마다 새 Claude Code 세션을 자동 감지 (재시작 불필요)
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

Claude Code는 모든 활동을 `~/.claude/projects/` 내 transcript JSONL 파일에 기록합니다. monitor-agent가 이 파일들을 폴링(1초 간격)으로 감시하고, 파싱된 이벤트를 Server-Sent Events(SSE)로 브라우저에 스트리밍합니다.

```
Claude Code → transcript.jsonl → monitor-agent (server.mjs) → SSE → 브라우저 대시보드
```

10초마다 새 세션을 자동 감지하므로, 새 Claude Code 세션을 시작해도 서버를 재시작할 필요가 없습니다.

## 대시보드 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│  monitor-agent         실행중: 2  완료: 2472  에러: 188  │
├──────────────────────────────────────────────────────────┤
│  활동 피드                                               │
│  [검색 (프롬프트, 파일명, 명령어...)]                    │
│  [IT] [TYDEV] [TYINT]                                    │
│                                                          │
│  ▼ IT 17:13:57 사이즈 전체적으로 지금보다 10%...     [5] │
│    17:19:25 ✓ Read dashboard.html  95ms                  │
│    ● 완료. 활동 피드 목록 전체 10% 커짐.                 │
│  ▶ IT 17:09:19 오른쪽 하단에 Projects 부분도...      [3] │
│  ▶ TYINT 16:45:22 주문 통합 API 수정해줘...         [12] │
│                                                          │
├─ ─ ─ ─ ─ ─ ─ ─ ─ 드래그로 크기 조절 ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│  코드 뷰어: dashboard.html                      1007 줄  │
│  (구문 강조된 파일 내용)                                 │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  Diff: Edit dashboard.html                     17:20:14  │
│  - 삭제된 코드 (빨강)                                    │
│  + 추가된 코드 (초록)                                    │
├──────────────────────────────────────────────────────────┤
│  ● 연결됨                              이벤트: 2,662개  │
└──────────────────────────────────────────────────────────┘
```

## 요구 사항

- Node.js >= 18
- 활성화된 Claude Code 세션

## 라이선스

MIT
