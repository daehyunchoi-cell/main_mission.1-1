# Portfolio — 반응형 개발자 포트폴리오

외부 라이브러리 없이 **순수 HTML / CSS / JavaScript**로 만든 반응형 포트폴리오 웹사이트입니다.
GitHub API로 실제 저장소 목록을 불러오고, 로딩 · 성공 · 에러 · 빈 상태를 UI로 처리합니다.

## 배포 URL

- https://daehyunchoi-cell.github.io/portfolio/  ← 배포 후 실제 주소로 교체

---

## 목차

1. [사용 기술](#사용-기술)
2. [폴더 구조와 파일별 역할](#폴더-구조와-파일별-역할)
3. [화면 구성](#화면-구성)
4. [상태 → 렌더링 흐름](#상태--렌더링-흐름)
5. [구현한 인터랙션](#구현한-인터랙션)
6. [다크 모드와 FOUC 방지](#다크-모드와-fouc-방지)
7. [모바일 메뉴 포커스 관리](#모바일-메뉴-포커스-관리)
8. [GitHub API 상태 처리와 강건성](#github-api-상태-처리와-강건성)
9. [폼 검증 — 클라이언트와 서버](#폼-검증--클라이언트와-서버)
10. [Flexbox와 Grid를 어디에 왜 썼는가](#flexbox와-grid를-어디에-왜-썼는가)
11. [CSS 변수 설계](#css-변수-설계)
12. [성능 — 부분 갱신 전략](#성능--부분-갱신-전략)
13. [반응형 검증 절차](#반응형-검증-절차)
14. [접근성 체크리스트](#접근성-체크리스트)
15. [로컬 실행 / 배포](#로컬-실행)
16. [스크린샷](#스크린샷)

---

## 사용 기술

| 구분 | 사용 내용 |
|---|---|
| HTML | 시맨틱 태그(`header`, `nav`, `main`, `section`, `article`, `footer`), `label`–`for` 연결, `aria-labelledby`, 이미지 `alt` |
| CSS | CSS 변수(`:root`, `[data-theme="dark"]`), Flexbox(네비), Grid(`auto-fit`/`minmax`), 모바일 퍼스트 미디어쿼리 |
| JavaScript | `querySelector`, `addEventListener`, `classList`, `fetch` + `async/await`, `AbortController`, `try/catch`, `map`/`filter`/`forEach`, 템플릿 리터럴, 구조분해 할당 |
| API | GitHub REST API `GET /users/{username}/repos` |
| 배포 | GitHub Pages |

---

## 폴더 구조와 파일별 역할

```
portfolio/
├── index.html          # 문서 구조 + 테마 초기화 스크립트(인라인)
├── css/
│   └── style.css       # 디자인 토큰 → 컴포넌트 → 미디어쿼리 순의 단일 스타일시트
├── js/
│   └── main.js         # 상태·렌더 함수·이벤트 핸들러 (defer로 연결)
├── images/
│   └── profile.svg     # 프로필 이미지 (실제 사진으로 교체 가능)
└── README.md
```

**파일별 책임**

| 파일 | 담당하는 것 | 담당하지 않는 것 |
|---|---|---|
| `index.html` | 문서의 뼈대, 접근성 속성, 상태 UI가 들어갈 빈 컨테이너 | 스타일 값, 이벤트 연결(인라인 `onclick` 없음) |
| `css/style.css` | 색·간격·레이아웃·반응형·모션 | 데이터에 따라 달라지는 내용 |
| `js/main.js` | 상태 보관, 상태 변경, DOM 갱신, 이벤트 처리 | 스타일 값 직접 지정(클래스 토글로만 제어) |
| `images/` | 정적 이미지 자산 | — |

**`css/style.css` 내부 순서** — 토큰 → 리셋 → 버튼 → 헤더 → 플로팅 버튼 → Hero → 섹션 공통 → Projects → Contact → Footer → 애니메이션 → 768px → 1024px → `prefers-reduced-motion`.
모바일 퍼스트라 미디어쿼리는 항상 파일 뒤쪽에 모여 있습니다.

**`js/main.js` 내부 순서** — 설정 상수 → DOM 참조 → 상태와 `setState` → 렌더 함수 → 기능별 핸들러 → 이벤트 연결·초기화.
"어디서 화면이 바뀌는가"를 찾을 때는 `render`로 시작하는 함수만 보면 됩니다.

---

## 화면 구성

- **Hero** — 인사말, CTA 버튼
- **About** — 프로필 이미지, 자기소개, 저장소 개수
- **Skills** — 기술 스택 목록
- **Projects** — GitHub API로 불러온 저장소 카드 + 언어별 필터
- **Contact** — 문의 폼(이름 / 이메일 / 메시지) + 유효성 검사
- **Footer** — 저작권, 소셜 링크

---

## 상태 → 렌더링 흐름

이 프로젝트는 DOM을 여기저기서 직접 고치지 않고, **이벤트 → 상태 변경 → 렌더 함수 호출** 한 방향으로만 흐릅니다.
(React의 state → 렌더링 구조를 손으로 구현한 형태입니다.)

```
[사용자 이벤트]        [상태 변경]                    [화면 갱신]
     │                     │                              │
 click ─────► setState('theme', 'dark') ─────► renderTheme()
                           │                              │
                    state.theme = 'dark'      <html data-theme="dark">
```

### 지켜야 할 규칙 3가지

1. 화면을 바꾸는 코드는 `render*` 함수 안에만 둔다.
2. 상태는 `setState()`로만 바꾼다. `state.xxx = ...`로 직접 대입하지 않는다.
3. 이벤트 핸들러는 이름 있는 함수로 선언한다.
   익명 화살표 함수를 바로 넘기면 나중에 `removeEventListener`를 걸 수 없고, 에러 스택에도 이름이 남지 않습니다.

### `setState` 구현

객체 상태는 기존 객체를 고치지 않고 **복사본으로 교체**합니다(불변성).
직접 수정하면 "이전 상태"와 비교할 수 없어져, 나중에 React로 옮길 때 그대로 문제가 됩니다.

```js
const renderers = {
    theme: renderTheme,
    projects: renderProjects,
    form: renderFormErrors
};

function setState(key, patch) {
    const previous = state[key];
    const isPlainObject = typeof previous === 'object' && previous !== null && !Array.isArray(previous);

    state[key] = isPlainObject ? { ...previous, ...patch } : patch;   // 얕은 병합 또는 통째 교체
    renderers[key]();                                                 // 해당 영역만 다시 그림
}
```

### 실제 흐름 예시 — 언어 필터

```js
// 1. 이벤트: 필터 버튼 클릭 (부모에 한 번만 건 이벤트 위임)
function handleFilterClick(event) {
    const button = event.target.closest('.filter-btn');
    if (!button) return;

    setState('projects', { filter: button.dataset.filter });   // 2. 상태 변경
}

// 3. 렌더: setState가 자동으로 호출
function renderProjects() {
    const { status, repos, filter } = state.projects;
    if (status !== 'success') { /* 로딩·에러·빈 상태 처리 */ return; }

    const visible = filter === 'all'
        ? repos
        : repos.filter((repo) => (repo.language || 'Other') === filter);

    projectsGrid.innerHTML = visible.map((repo) => cardCache.get(repo.id)).join('');
}
```

`handleFilterClick`은 DOM을 전혀 만지지 않습니다. 무엇을 보여줄지는 오직 `renderProjects`가 상태를 읽고 결정합니다.

### 구현된 4가지 흐름

| # | 이벤트 | 상태 | 렌더 |
|---|---|---|---|
| 1 | 테마 토글 클릭 | `state.theme` | `renderTheme()` → `data-theme` 교체 |
| 2 | 페이지 로드 / 재시도 클릭 | `state.projects.status` (`loading`→`success`/`error`/`empty`) | `renderProjects()` |
| 3 | 폼 `input` / `submit` | `state.form.errors` | `renderFormErrors()` |
| 4 | 필터 버튼 클릭 | `state.projects.filter` | `renderProjects()` |

---

## 구현한 인터랙션

| 기능 | 동작 | 기준값 |
|---|---|---|
| 햄버거 메뉴 | 768px 미만에서 버튼 클릭 시 메뉴 열림/닫힘 | `classList.toggle('active')` |
| 부드러운 스크롤 | 네비 클릭 시 해당 섹션으로 이동 | `scrollIntoView({ behavior: 'smooth' })` |
| 네비 배경 변경 | 스크롤 시 헤더에 배경·테두리 적용 | **60px** |
| 스크롤 탑 버튼 | 일정 위치 이상에서 버튼 표시 | **300px** |
| 스크롤 등장 애니메이션 | Intersection Observer로 요소 등장 | **threshold 0.2** |
| 현재 섹션 표시 | 화면 중앙 섹션의 네비 링크 강조 | `rootMargin: -45% 0 -50%` |
| 다크 모드 | 토글 → `data-theme` 교체 → localStorage 저장 | 첫 방문은 `prefers-color-scheme` 따름 |
| API 타임아웃 | `AbortController`로 요청 중단 | **8초** |
| 자동 재시도 | 재시도 가능한 실패에 한해 지수 백오프 | **최대 2회 / 600ms → 1200ms** |

> 기준값은 `js/main.js` 최상단 상수로 모아 두었습니다. `NAV_SCROLL_THRESHOLD`, `SCROLL_TOP_THRESHOLD`, `REVEAL_THRESHOLD`, `FETCH_TIMEOUT`, `MAX_RETRIES`, `RETRY_BASE_DELAY` 한 곳만 고치면 됩니다.

---

## 다크 모드와 FOUC 방지

테마 결정 코드만 `index.html`의 `<head>`에 **인라인 + 동기 실행**으로 두었습니다. 나머지 JS는 모두 `defer`입니다.

**왜 이 스크립트만 예외인가**

브라우저는 HTML을 위에서 아래로 읽습니다. 테마 결정 코드를 `main.js`에 넣고 `defer`로 연결하면, 그 코드는 HTML 파싱이 **끝난 뒤에** 실행됩니다. 그 사이 브라우저는 `:root`의 라이트 테마 변수로 첫 화면을 이미 그려버립니다. 다크 테마 사용자에게는 **흰 화면이 한 번 번쩍인 뒤** 검은 화면으로 바뀌는 현상이 보입니다. 이것이 FOUC(Flash Of Unstyled Content)입니다.

그래서 이 코드만 첫 페인트보다 먼저 실행되도록 인라인으로 두었습니다. 코드가 짧아 렌더링을 늦추는 비용은 무시할 수준입니다.

**결정 우선순위**

1. `localStorage`에 저장된 사용자의 명시적 선택
2. 저장값이 없으면 OS 설정(`prefers-color-scheme`)

`localStorage`는 사생활 보호 모드 등에서 접근이 막힐 수 있어 `try/catch`로 감쌌습니다. 실패해도 2번으로 자연스럽게 넘어갑니다.

---

## 모바일 메뉴 포커스 관리

메뉴는 시각적으로만 열려서는 안 됩니다. 키보드 초점도 함께 움직여야 스크린리더 사용자가 메뉴가 열린 것을 인지할 수 있습니다.

| 상황 | 처리 |
|---|---|
| 메뉴를 열 때 | 첫 번째 메뉴 링크로 초점 이동 |
| 메뉴를 닫을 때 | 초점을 햄버거 버튼으로 **복귀** |
| 열려 있는 동안 Tab | 메뉴 밖으로 나가지 않도록 순환(포커스 트랩) |
| `Esc` 키 | 메뉴를 닫고 초점 복귀 |
| 메뉴 밖 클릭 | 메뉴를 닫음(초점은 클릭한 곳에 유지) |
| 메뉴 링크 클릭 | 메뉴만 닫고 초점은 목적지 섹션으로 (햄버거로 되돌리지 않음) |
| 768px 이상으로 넓어질 때 | 잠금 해제 후 상태 초기화 |
| 메뉴가 접혀 있을 때 | CSS `visibility: hidden`으로 **Tab 순서에서도 제외** |

마지막 항목이 특히 중요합니다. `max-height: 0`과 `overflow: hidden`만으로는 화면에서 사라져도 링크가 여전히 Tab으로 잡혀서, 키보드 사용자가 보이지 않는 링크들을 지나가게 됩니다.

---

## GitHub API 상태 처리와 강건성

| 상태 | 화면 |
|---|---|
| 로딩 | 스피너 + "프로젝트를 불러오는 중..." (재시도 중에는 진행 상황 표시) |
| 성공 | 저장소 카드 그리드 (이름 · 설명 · 언어 · ★ · 최종 수정일) |
| 에러 | "프로젝트를 불러올 수 없습니다" + **원인별 상세 메시지** + 다시 시도 버튼 |
| 빈 상태 | "표시할 프로젝트가 없습니다" |

### 실패는 한 종류가 아닙니다

| 원인 | 자동 재시도 | 사용자에게 보이는 메시지 |
|---|---|---|
| 네트워크 끊김 (`TypeError`) | O | 네트워크 상태 확인 안내 |
| 타임아웃 (8초 초과) | O | "응답 시간이 초과되었습니다 (8초)" |
| 서버 오류 (5xx) | O | "GitHub 응답 오류 (HTTP 5xx)" |
| **403 요청 한도 초과** | X | "요청 한도를 초과했습니다. HH:MM 이후에 다시 시도해 주세요. (비로그인 요청은 IP당 시간당 60회 제한)" |
| **404 사용자 없음** | X | "'{아이디}' 사용자를 찾을 수 없습니다. GITHUB_USERNAME 값을 확인해 주세요." |

403과 404는 즉시 다시 요청해도 결과가 같으므로 재시도하지 않고 원인을 바로 안내합니다.
403은 응답 헤더 `X-RateLimit-Remaining`이 `0`인지로 판별하고, `X-RateLimit-Reset`(Unix time)을 사람이 읽을 시각으로 변환해 보여줍니다.

### 타임아웃과 지수 백오프

`fetch`에는 timeout 옵션이 없어 `AbortController`로 직접 제한 시간을 겁니다.

```js
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);   // 8초
// ...
const response = await fetch(url, { signal: controller.signal });
```

재시도는 **지수 백오프**입니다. 실패 직후 곧바로 다시 요청하면 서버가 불안정할 때 부하만 더합니다.

```
1차 실패 → 600ms 대기 → 2차 시도
2차 실패 → 1200ms 대기 → 3차 시도
3차 실패 → 사용자에게 에러 UI 표시 + 수동 재시도 버튼
```

포크한 저장소는 `data.filter((repo) => !repo.fork)`로 제외했습니다.

---

## 폼 검증 — 클라이언트와 서버

`novalidate`로 브라우저 기본 검증을 끄고 직접 처리합니다. 브라우저 기본 말풍선은 스타일을 바꿀 수 없고 문구도 제어할 수 없기 때문입니다.

| 필드 | 규칙 |
|---|---|
| 이름 | 필수, 2자 이상 |
| 이메일 | 필수, `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` 형식 |
| 메시지 | 필수, 10자 이상 |

`input` 이벤트는 **이미 에러가 떠 있는 필드만** 다시 검사합니다. 처음부터 매 글자 검사하면 입력 도중 계속 빨개져서 오히려 방해가 되기 때문입니다. 첫 검사는 `blur`와 `submit` 시점에 일어납니다.

### 서버 검증 에러를 반영하려면

클라이언트 검증은 UX용이고, 진짜 검증은 서버가 합니다. 백엔드(Formspree, EmailJS 등)를 붙이면 서버가 돌려준 필드별 에러를 `applyServerErrors()`에 그대로 넘기면 됩니다. 이미 만들어 둔 훅입니다.

```js
async function handleFormSubmit(event) {
    event.preventDefault();
    if (!FIELD_NAMES.map(validateField).every(Boolean)) return;

    setFormStatus('전송 중...', '');

    try {
        const response = await fetch('https://formspree.io/f/XXXX', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(Object.fromEntries(new FormData(contactForm)))
        });

        if (!response.ok) {
            const { errors = {} } = await response.json();
            applyServerErrors(errors);              // { email: '이미 등록된 주소입니다.' }
            setFormStatus('입력값을 다시 확인해 주세요.', 'error');
            return;
        }

        setFormStatus('메시지가 정상적으로 접수되었습니다. 감사합니다!', 'success');
        contactForm.reset();
        setState('form', { errors: { name: '', email: '', message: '' } });
    } catch (error) {
        setFormStatus('전송에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'error');
    }
}
```

서버 에러도 클라이언트 에러와 **같은 상태(`state.form.errors`)와 같은 렌더 함수**를 통과합니다. 표시 경로를 하나로 유지하는 것이 핵심입니다.

---

## Flexbox와 Grid를 어디에 왜 썼는가

둘 다 쓸 수 있는 경우가 많지만, **차원**과 **주도권**으로 나눠 선택했습니다.

| 위치 | 선택 | 이유 |
|---|---|---|
| 헤더 (`.header-inner`) | **Flexbox** | 로고와 메뉴를 가로 한 줄에서 양 끝으로 밀어내는 1차원 배치. 요소 개수가 고정이고 각자 자기 콘텐츠만큼 차지하면 되므로 `justify-content: space-between` 한 줄로 끝납니다. Grid로 하면 열 정의가 오히려 번거롭습니다. |
| 메뉴 (`.nav-links`) | **Flexbox** | 항목 수가 바뀌어도 `gap`만으로 간격이 유지되는 1차원 나열. |
| 프로젝트 카드 (`.project-grid`) | **Grid** | 행과 열이 함께 있는 2차원 배치. 카드 개수가 API 응답에 따라 매번 달라지므로 열 수를 미디어쿼리로 지정할 수 없습니다. `repeat(auto-fit, minmax(min(280px, 100%), 1fr))`로 **브라우저가 폭에 맞춰 열 수를 스스로 계산**하게 둡니다. Flexbox의 `wrap`으로도 줄바꿈은 되지만, 마지막 줄 항목들의 너비가 앞줄과 어긋납니다. |
| 섹션 레이아웃 (`.section-grid`) | **Grid** | 왼쪽 라벨 열(180px 고정) + 오른쪽 본문 열(가변)이라는 명시적 2열 구조. |
| 통계 (`.about-stats`) | **Grid** | 3등분 고정이 필요해 `repeat(3, 1fr)`. |

정리하면 **"줄 세우기는 Flex, 판 짜기는 Grid"** 이고, **개수를 모를 때는 Grid의 `auto-fit`** 입니다.

---

## CSS 변수 설계

`:root`에 토큰을 모으고 `[data-theme="dark"]`에서 **같은 이름을 덮어쓰기만** 합니다. 컴포넌트 CSS는 한 줄도 바뀌지 않습니다.

| 변수 | 쓰이는 곳 | 의도 |
|---|---|---|
| `--bg` | 페이지 배경, 헤더 반투명 배경의 재료 | 가장 뒤에 있는 면 |
| `--surface` | 카드, 폼, 플로팅 버튼, 모바일 메뉴 패널 | 떠 있는 면 |
| `--surface-2` | 입력 필드 배경, 이미지 자리 | 눌려 있는 면 |
| `--text` | 본문 글자, 기본 버튼 배경(반전 사용) | |
| `--muted` | 보조 설명, 비활성 네비, 카드 메타 | |
| `--line` | 1px 경계선 전용 | 색이 아니라 "선"이라는 역할로 이름 지음 |
| `--dark` / `--on-dark` | Skills 섹션, 푸터 | 테마와 무관하게 항상 어두운 블록 |
| `--accent` | Contact 배경, Skills 마커, 버튼 안 원 | **넓은 면에만** |
| `--accent-dark` | h1/h2의 `em` | **큰 글자용**. 라이트 테마 대비 3.2:1 |
| `--accent-strong` | 로고 점, 섹션 번호, 포커스 링 | **작은 글자용**. 대비 4.6:1 |
| `--error` / `--success` | 폼 검증 결과 | |
| `--space-*` | 8의 배수 간격 스케일 | 섹션 여백은 `--space-6` |
| `--nav-h` | 헤더 높이 | `scroll-margin-top` 계산에도 재사용 |

**강조색을 셋으로 나눈 이유**: 라임 원색(`#b8ff3d`)은 밝은 배경 위에서 대비가 약 1.9:1이라 글자로 쓰면 읽히지 않습니다. 그래서 면에만 쓰고, 글자용은 크기별로 분리해 WCAG AA 기준(큰 글자 3:1, 작은 글자 4.5:1)을 각각 통과시켰습니다. 다크 테마에서는 어두운 배경 덕분에 대비가 충분하므로 두 글자용 변수를 다시 원색으로 되돌립니다.

---

## 성능 — 부분 갱신 전략

현재 저장소 수는 수십 개 수준이라 `innerHTML` 전체 교체로 충분합니다. 다만 필터를 바꿀 때마다 카드 HTML을 처음부터 다시 만드는 것은 낭비이므로, **카드 문자열을 저장소당 한 번만 만들어 캐시**합니다.

```js
const cardCache = new Map();   // repo.id → 카드 HTML 문자열

// 데이터를 받은 직후 한 번만 생성
cardCache.clear();
repos.forEach((repo) => cardCache.set(repo.id, createCard(repo)));

// 필터 변경 시에는 골라서 붙이기만 함
projectsGrid.innerHTML = visible.map((repo) => cardCache.get(repo.id)).join('');
```

그 밖의 처리:

- `scroll` 리스너에 `{ passive: true }` — 스크롤 중 브라우저가 기다리지 않게 합니다.
- 필터 버튼은 **이벤트 위임** — 버튼이 몇 개 생기든 부모에 리스너 하나만 붙습니다.
- 등장 애니메이션은 나타난 요소를 `unobserve`로 관찰 해제합니다.

**데이터가 수백~수천 건으로 늘어난다면** 다음 순서로 넘어가야 합니다.

1. 전체 교체 대신 **키 기반 비교**(`repo.id`) — 새로 생긴 것만 추가, 사라진 것만 제거, 나머지는 유지
2. `innerHTML` 대신 `DocumentFragment` + `appendChild`로 리플로우 횟수 축소
3. 화면에 보이는 범위만 그리는 가상 스크롤 또는 페이지네이션

지금 단계에서 1~3을 미리 넣지 않은 것은 의도적입니다. 데이터 규모가 작을 때는 코드 복잡도만 늘고 체감 성능 차이가 없습니다.

---

## 반응형 검증 절차

브레이크포인트는 두 개입니다.

| 화면 | 처리 |
|---|---|
| ~767px | 1단 레이아웃, 햄버거 메뉴, 네비 접힘 패널 |
| ≥768px | 네비 펼침(햄버거 숨김), About 2단, Contact 2단 |
| ≥1024px | Hero 2단, 섹션 라벨 좌측 열 분리, 여백 확대 |

Projects 카드는 브레이크포인트 없이 `auto-fit`으로 열 수가 자동 조절됩니다.

**검증 방법 (Chrome DevTools)**

1. `F12` → `Ctrl/Cmd + Shift + M`으로 기기 툴바를 켭니다.
2. 폭을 **375 / 767 / 768 / 1023 / 1024 / 1440px** 순으로 바꾸며 확인합니다. 경계값 앞뒤(767↔768, 1023↔1024)를 반드시 함께 봅니다.
3. 각 폭에서 아래를 확인합니다.

| 확인 항목 | 375 | 768 | 1024+ |
|---|---|---|---|
| 가로 스크롤이 생기지 않는가 | ✔ | ✔ | ✔ |
| 햄버거 버튼 | 보임 | 숨김 | 숨김 |
| 네비 메뉴 | 접힘 | 가로 펼침 | 가로 펼침 |
| Hero | 1단 | 1단 | 2단 |
| About | 1단 | 이미지+본문 2단 | 2단(라벨 열 추가) |
| Projects 카드 | 1열 | 2열 | 3열 이상 |
| Contact | 1단 | 2단 | 2단 |
| 플로팅 버튼 | 우하단 16px | 우하단 25px | 우하단 25px |

4. 다크/라이트 각각에서 같은 절차를 반복합니다.
5. `Ctrl/Cmd + Shift + P` → `Capture full size screenshot`으로 브레이크포인트별 스크린샷을 저장합니다.

---

## 접근성 체크리스트

키보드와 스크린리더로 아래를 점검했습니다.

**키보드만으로 (마우스 사용 금지)**

- [x] `Tab` 한 번에 "본문 바로가기" 링크가 나타나고, `Enter`로 본문으로 이동한다
- [x] 모든 인터랙티브 요소에 초점 표시(`:focus-visible`)가 보인다
- [x] 메뉴가 접혀 있을 때 숨겨진 링크로 초점이 들어가지 않는다
- [x] 햄버거를 `Enter`로 열면 첫 링크로 초점이 이동한다
- [x] 메뉴가 열린 동안 `Tab`이 메뉴 밖으로 나가지 않는다
- [x] `Esc`로 메뉴가 닫히고 초점이 햄버거로 돌아온다
- [x] 폼을 비운 채 `Enter`로 제출하면 첫 오류 필드로 초점이 이동한다
- [x] 필터 버튼을 `Space`/`Enter`로 조작할 수 있다

**스크린리더 (VoiceOver `Cmd+F5` / NVDA)**

- [x] 각 섹션이 `aria-labelledby`로 이름과 함께 읽힌다 (About은 `sr-only` 제목 사용)
- [x] 햄버거 버튼이 "메뉴 열기, 축소됨/확장됨"으로 읽힌다 (`aria-expanded`)
- [x] 테마 버튼의 현재 상태가 읽힌다 (`aria-pressed`)
- [x] 로딩 상태 변화가 `role="status"`로 자동 안내된다
- [x] 에러 발생 시 `role="alert"`로 즉시 안내된다
- [x] 잘못된 입력 필드가 "잘못된 값"으로 읽힌다 (`aria-invalid`)
- [x] 에러 메시지가 해당 필드와 연결되어 읽힌다 (`aria-describedby`)
- [x] 장식용 요소(궤도, 아이콘)는 읽히지 않는다 (`aria-hidden`)
- [x] 프로필 이미지에 의미 있는 `alt`가 있다

**그 외**

- [x] 강조색 대비: 큰 글자 3.2:1, 작은 글자 4.6:1 (WCAG AA 통과)
- [x] `prefers-reduced-motion` 설정 시 모든 애니메이션 제거
- [x] `lang="ko"` 지정
- [x] 에러 메시지 영역에 `min-height`를 줘서 표시될 때 레이아웃이 밀리지 않음

> 자동 점검은 DevTools의 **Lighthouse → Accessibility** 또는 axe DevTools 확장으로 함께 돌렸습니다.

---

## 로컬 실행

1. 저장소를 클론합니다.
2. VS Code에서 폴더를 엽니다.
3. **Live Server** 확장을 설치한 뒤 `index.html`에서 `Open with Live Server`를 실행합니다.

```bash
git clone https://github.com/daehyunchoi-cell/portfolio.git
cd portfolio
```

> `file://`로 직접 열면 GitHub API 요청이 CORS로 막힐 수 있습니다. 반드시 Live Server 등 로컬 서버로 실행하세요.

## 배포 방법 (GitHub Pages)

1. GitHub에 `portfolio` 저장소를 만들고 푸시합니다.
2. 저장소 **Settings → Pages** 로 이동합니다.
3. **Source**를 `Deploy from a branch`, **Branch**를 `main` / `/ (root)`로 설정하고 저장합니다.
4. 1~2분 뒤 `https://<아이디>.github.io/portfolio/`에서 접속할 수 있습니다.

---

## 스크린샷

| 데스크톱 1440px (라이트) | 태블릿 768px | 모바일 375px (다크) |
|---|---|---|
| ![데스크톱](images/screenshot-1440.png) | ![태블릿](images/screenshot-768.png) | ![모바일](images/screenshot-375.png) |

| Projects 로딩 | Projects 에러 |
|---|---|
| ![로딩 상태](images/screenshot-loading.png) | ![에러 상태](images/screenshot-error.png) |

> 위 파일들을 `images/` 폴더에 추가하세요. 에러 상태는 `js/main.js`의 `GITHUB_USERNAME`을 없는 아이디로 잠시 바꾸면 재현할 수 있습니다.

---

## 남은 보너스 과제

- [ ] Hero 타이핑 효과
- [ ] Formspree / EmailJS 연동으로 폼 실제 전송 (`applyServerErrors` 훅은 준비되어 있음)
