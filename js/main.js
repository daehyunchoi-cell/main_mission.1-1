/* =========================================================
   Portfolio — main.js
   ---------------------------------------------------------
   설계 규칙 3가지
   1) 화면을 바꾸는 코드는 render* 함수 안에만 둔다.
   2) 상태는 setState()로만 바꾼다. 직접 state.xxx = ... 하지 않는다.
   3) 이벤트 핸들러는 이름 있는 함수로 선언하고 addEventListener에 넘긴다.
      (익명 화살표 함수를 바로 넘기면 나중에 removeEventListener를 할 수 없고,
       스택 트레이스에도 이름이 남지 않습니다.)

   흐름은 항상 한 방향입니다.
   이벤트 → setState(다음 상태) → render*() → DOM
   ========================================================= */

/* =========================================================
   0. 설정 상수 (README의 기준값 표와 1:1로 대응)
   ========================================================= */
const GITHUB_USERNAME = 'daehyunchoi-cell';   // ← 본인 GitHub 아이디로 변경
const NAV_SCROLL_THRESHOLD = 60;              // 헤더 배경이 바뀌는 스크롤 위치(px)
const SCROLL_TOP_THRESHOLD = 300;             // 맨 위로 버튼이 나타나는 위치(px)
const REVEAL_THRESHOLD = 0.2;                 // Intersection Observer 임계값
const THEME_KEY = 'theme';

const FETCH_TIMEOUT = 8000;                   // 요청 1회 제한 시간(ms)
const MAX_RETRIES = 2;                        // 자동 재시도 횟수
const RETRY_BASE_DELAY = 600;                 // 백오프 기준 대기(ms): 600 → 1200

/* =========================================================
   1. DOM 참조
   ========================================================= */
const siteHeader = document.querySelector('#siteHeader');
const hamburger = document.querySelector('#hamburger');
const primaryNav = document.querySelector('#primaryNav');
const navAnchors = document.querySelectorAll('.nav-links a');
const themeToggle = document.querySelector('#themeToggle');
const scrollTopBtn = document.querySelector('#scrollTopBtn');

const projectsGrid = document.querySelector('#projectsGrid');
const projectsLoading = document.querySelector('#projectsLoading');
const projectsLoadingText = document.querySelector('#projectsLoadingText');
const projectsError = document.querySelector('#projectsError');
const projectsErrorDetail = document.querySelector('#projectsErrorDetail');
const projectsEmpty = document.querySelector('#projectsEmpty');
const projectFilters = document.querySelector('#projectFilters');
const retryButton = document.querySelector('#retryButton');
const statProjectCount = document.querySelector('#statProjectCount');

const contactForm = document.querySelector('#contactForm');
const formStatus = document.querySelector('#formStatus');

const mobileNavQuery = window.matchMedia('(max-width: 767px)');

/* =========================================================
   2. 상태와 setState
   ---------------------------------------------------------
   상태를 바꾸는 통로를 하나로 좁혀두면
   "언제 화면이 갱신되는가"를 한 곳에서만 확인하면 됩니다.
   객체 상태는 기존 값을 복사한 새 객체로 교체합니다(불변성).
   기존 객체를 직접 수정하면 "이전 상태"와 비교할 수 없게 되고,
   나중에 React로 옮길 때 그대로 문제가 됩니다.
   ========================================================= */
const state = {
    theme: document.documentElement.getAttribute('data-theme') || 'light',
    projects: {
        status: 'idle',       // idle | loading | success | error | empty
        repos: [],
        filter: 'all',
        errorMessage: ''
    },
    form: {
        errors: { name: '', email: '', message: '' }
    }
};

// 상태 영역별로 어떤 렌더 함수가 책임지는지 명시합니다.
const renderers = {
    theme: renderTheme,
    projects: renderProjects,
    form: renderFormErrors
};

function setState(key, patch) {
    const previous = state[key];
    const isPlainObject = typeof previous === 'object' && previous !== null && !Array.isArray(previous);

    // 객체면 얕은 병합, 원시값이면 통째로 교체
    state[key] = isPlainObject ? { ...previous, ...patch } : patch;

    renderers[key]();
}

/* =========================================================
   3. 렌더 함수 — 여기서만 DOM을 만집니다
   ========================================================= */
function renderTheme() {
    const isDark = state.theme === 'dark';

    document.documentElement.setAttribute('data-theme', state.theme);
    themeToggle.textContent = isDark ? '☀' : '◐';
    themeToggle.setAttribute('aria-pressed', String(isDark));
    themeToggle.setAttribute('aria-label', isDark ? '라이트모드 전환' : '다크모드 전환');
}

function renderFilters() {
    const { repos, filter } = state.projects;

    // 저장소에 실제로 등장한 언어만 모아 버튼을 만듭니다.
    const languages = [...new Set(repos.map((repo) => repo.language || 'Other'))].sort();
    const options = ['all', ...languages];

    projectFilters.innerHTML = options
        .map((value) => `
            <button type="button" class="filter-btn" data-filter="${escapeHtml(value)}"
                    aria-pressed="${value === filter}">
                ${value === 'all' ? '전체' : escapeHtml(value)}
            </button>
        `)
        .join('');
}

function renderProjects() {
    const { status, repos, filter, errorMessage } = state.projects;

    // 어떤 블록을 보여줄지 한 곳에서 결정합니다.
    projectsLoading.hidden = status !== 'loading';
    projectsError.hidden = status !== 'error';
    projectsEmpty.hidden = status !== 'empty';
    projectsGrid.hidden = status !== 'success';
    projectFilters.hidden = status !== 'success';

    statProjectCount.textContent = status === 'success'
        ? String(repos.length).padStart(2, '0')
        : '—';

    if (status === 'error') {
        projectsErrorDetail.textContent = errorMessage;
        projectsGrid.innerHTML = '';
        return;
    }

    if (status !== 'success') {
        projectsGrid.innerHTML = '';
        return;
    }

    renderFilters();

    const visible = filter === 'all'
        ? repos
        : repos.filter((repo) => (repo.language || 'Other') === filter);

    // 카드 HTML은 cardCache에 이미 만들어져 있습니다.
    // 필터를 바꿀 때는 문자열을 다시 만들지 않고 골라 붙이기만 합니다.
    projectsGrid.innerHTML = visible.map((repo) => cardCache.get(repo.id)).join('');

    observeReveals();   // 새로 그린 카드에도 등장 애니메이션 연결
}

function renderFormErrors() {
    FIELD_NAMES.forEach((fieldName) => {
        const input = document.querySelector(`#${fieldName}`);
        const errorBox = document.querySelector(`#${fieldName}Error`);
        const message = state.form.errors[fieldName];

        errorBox.textContent = message;
        input.classList.toggle('invalid', Boolean(message));
        input.setAttribute('aria-invalid', String(Boolean(message)));
    });
}

/* =========================================================
   4. 다크 모드
   클릭 → setState('theme') → renderTheme() → data-theme 교체
   ========================================================= */
function handleThemeToggle() {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';

    try {
        localStorage.setItem(THEME_KEY, nextTheme);   // 새로고침 후에도 유지
    } catch (error) {
        console.warn('테마를 저장하지 못했습니다.', error);
    }

    setState('theme', nextTheme);
}

/* =========================================================
   5. 햄버거 메뉴 + 포커스 관리
   ---------------------------------------------------------
   메뉴는 시각적으로만 열리는 것이 아니라 "키보드 초점"도 함께
   움직여야 합니다. 그렇지 않으면 스크린리더 사용자는 메뉴가
   열린 줄 모른 채 뒤쪽 콘텐츠를 계속 읽게 됩니다.

   - 열 때: 첫 메뉴 링크로 초점을 옮긴다
   - 닫을 때: 초점을 햄버거 버튼으로 되돌린다(원위치 복귀)
   - 열려 있는 동안: Tab이 메뉴 밖으로 나가지 않도록 가둔다(포커스 트랩)
   - Esc: 닫는다
   - 접혀 있을 때: CSS visibility:hidden으로 Tab 순서에서도 제외한다
   ========================================================= */
function getNavFocusables() {
    return [hamburger, ...primaryNav.querySelectorAll('a')];
}

function isNavOpen() {
    return primaryNav.classList.contains('active');
}

function setNavOpen(isOpen, { moveFocus = true } = {}) {
    primaryNav.classList.toggle('active', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
    hamburger.setAttribute('aria-label', isOpen ? '메뉴 닫기' : '메뉴 열기');

    if (!moveFocus) return;

    if (isOpen) {
        const [, firstLink] = getNavFocusables();
        if (firstLink) firstLink.focus();
    } else {
        hamburger.focus();
    }
}

function handleHamburgerClick() {
    setNavOpen(!isNavOpen());
}

function handleNavLinkClick() {
    // 링크를 눌렀을 때는 초점이 목적지 섹션으로 가야 하므로
    // 햄버거로 되돌리지 않습니다.
    if (isNavOpen()) setNavOpen(false, { moveFocus: false });
}

function handleDocumentKeydown(event) {
    if (!isNavOpen()) return;

    if (event.key === 'Escape') {
        setNavOpen(false);   // 초점은 햄버거로 복귀
        return;
    }

    if (event.key !== 'Tab') return;

    const focusables = getNavFocusables();
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

function handleDocumentClick(event) {
    if (!isNavOpen()) return;
    if (event.target.closest('#primaryNav') || event.target.closest('#hamburger')) return;
    setNavOpen(false, { moveFocus: false });
}

function handleViewportChange(event) {
    // 데스크톱 폭으로 넓어지면 메뉴는 항상 펼쳐진 상태이므로 잠금을 풉니다.
    if (!event.matches) setNavOpen(false, { moveFocus: false });
}

/* =========================================================
   6. 부드러운 스크롤
   ========================================================= */
function handleAnchorClick(event) {
    const anchor = event.currentTarget;
    const targetId = anchor.getAttribute('href');
    if (targetId === '#') return;

    const target = document.querySelector(targetId);
    if (!target) return;

    event.preventDefault();                        // 기본 점프 이동을 막고
    target.scrollIntoView({ behavior: 'smooth' }); // 부드럽게 이동
}

/* =========================================================
   7. 스크롤 상태 (헤더 배경 / 맨 위로 버튼)
   ========================================================= */
function handleWindowScroll() {
    const y = window.scrollY;
    siteHeader.classList.toggle('scrolled', y > NAV_SCROLL_THRESHOLD);
    scrollTopBtn.classList.toggle('show', y > SCROLL_TOP_THRESHOLD);
}

function handleScrollTopClick() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* =========================================================
   8. 현재 섹션 네비 하이라이트
   ========================================================= */
const navLinkMap = new Map();
navAnchors.forEach((anchor) => {
    navLinkMap.set(anchor.getAttribute('href').slice(1), anchor);
});

const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(({ isIntersecting, target }) => {
        if (!isIntersecting) return;

        navLinkMap.forEach((link, id) => {
            const isCurrent = id === target.id;
            link.classList.toggle('active', isCurrent);
            if (isCurrent) link.setAttribute('aria-current', 'true');
            else link.removeAttribute('aria-current');
        });
    });
}, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

/* =========================================================
   9. 스크롤 등장 애니메이션
   ========================================================= */
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);   // 한 번 나타나면 관찰 해제
    });
}, { threshold: REVEAL_THRESHOLD });

function observeReveals() {
    document.querySelectorAll('.reveal:not(.visible)').forEach((el) => {
        revealObserver.observe(el);
    });
}

/* =========================================================
   10. GitHub API 연동
   ---------------------------------------------------------
   실패는 한 종류가 아닙니다. 원인을 나눠서 다르게 다룹니다.

   재시도할 가치가 있는 실패  : 네트워크 끊김, 타임아웃, 5xx 서버 오류
   재시도해도 소용없는 실패   : 404(아이디 오타), 403 요청 한도 초과

   앞의 경우만 지수 백오프(600ms → 1200ms)로 최대 2회 자동 재시도하고,
   뒤의 경우는 즉시 사용자에게 원인을 안내합니다.
   ========================================================= */
const cardCache = new Map();   // repo.id → 카드 HTML 문자열

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatDate(isoString) {
    return new Date(isoString).toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function createCard(repo) {
    // 구조분해 할당: 필요한 값만 꺼내고, 긴 snake_case 키는 짧게 바꿔 씁니다.
    const {
        name,
        description,
        html_url: url,
        language,
        stargazers_count: stars,
        updated_at: updatedAt
    } = repo;

    return `
        <article class="project-card reveal">
            <h3><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)} <span aria-hidden="true">↗</span></a></h3>
            <p class="project-desc">${escapeHtml(description || '설명이 등록되지 않은 저장소입니다.')}</p>
            <p class="project-meta">
                <span class="project-lang">${escapeHtml(language || 'Other')}</span>
                <span>★ ${stars}</span>
                <span>업데이트 ${formatDate(updatedAt)}</span>
            </p>
        </article>
    `;
}

function buildHttpError(response) {
    const remaining = response.headers.get('X-RateLimit-Remaining');

    if (response.status === 403 && remaining === '0') {
        const resetAt = Number(response.headers.get('X-RateLimit-Reset')) * 1000;
        const resetText = Number.isFinite(resetAt) && resetAt > 0
            ? `${new Date(resetAt).toLocaleTimeString('ko-KR')} 이후`
            : '잠시 후';

        const error = new Error(
            `GitHub API 요청 한도를 초과했습니다. ${resetText}에 다시 시도해 주세요. ` +
            '(로그인하지 않은 요청은 IP당 시간당 60회로 제한됩니다.)'
        );
        error.retryable = false;
        return error;
    }

    if (response.status === 404) {
        const error = new Error(`'${GITHUB_USERNAME}' 사용자를 찾을 수 없습니다. GITHUB_USERNAME 값을 확인해 주세요.`);
        error.retryable = false;
        return error;
    }

    const error = new Error(`GitHub 응답 오류 (HTTP ${response.status})`);
    error.retryable = response.status >= 500;   // 서버 문제일 때만 재시도
    return error;
}

async function requestRepos(attempt = 0) {
    // AbortController로 제한 시간을 겁니다. fetch에는 timeout 옵션이 없습니다.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
        const response = await fetch(
            `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=100`,
            { signal: controller.signal, headers: { Accept: 'application/vnd.github+json' } }
        );

        if (!response.ok) throw buildHttpError(response);

        return await response.json();
    } catch (rawError) {
        const error = rawError.name === 'AbortError'
            ? Object.assign(
                new Error(`응답 시간이 초과되었습니다 (${FETCH_TIMEOUT / 1000}초). 네트워크 상태를 확인해 주세요.`),
                { retryable: true }
            )
            : rawError;

        const canRetry = error.retryable !== false && attempt < MAX_RETRIES;

        if (canRetry) {
            const wait = RETRY_BASE_DELAY * 2 ** attempt;   // 지수 백오프
            projectsLoadingText.textContent = `연결에 실패해 다시 시도합니다... (${attempt + 1}/${MAX_RETRIES})`;
            await delay(wait);
            return requestRepos(attempt + 1);
        }

        throw error;
    } finally {
        clearTimeout(timer);
    }
}

async function loadProjects() {
    projectsLoadingText.textContent = '프로젝트를 불러오는 중...';
    setState('projects', { status: 'loading', errorMessage: '' });

    try {
        const data = await requestRepos();
        const repos = data.filter((repo) => !repo.fork);   // 포크한 저장소는 제외

        // 카드 HTML을 저장소당 한 번만 만들어 캐시합니다.
        cardCache.clear();
        repos.forEach((repo) => cardCache.set(repo.id, createCard(repo)));

        setState('projects', {
            repos,
            filter: 'all',
            status: repos.length === 0 ? 'empty' : 'success'
        });
    } catch (error) {
        setState('projects', { status: 'error', errorMessage: error.message, repos: [] });
    }
}

function handleFilterClick(event) {
    const button = event.target.closest('.filter-btn');
    if (!button) return;

    setState('projects', { filter: button.dataset.filter });
}

/* =========================================================
   11. Contact 폼 유효성 검사
   입력/제출 → setState('form') → renderFormErrors()
   ========================================================= */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const validators = {
    name(value) {
        if (!value.trim()) return '이름을 입력해 주세요.';
        if (value.trim().length < 2) return '이름은 2자 이상 입력해 주세요.';
        return '';
    },
    email(value) {
        if (!value.trim()) return '이메일을 입력해 주세요.';
        if (!EMAIL_PATTERN.test(value.trim())) return '이메일 형식이 올바르지 않습니다.';
        return '';
    },
    message(value) {
        if (!value.trim()) return '메시지를 입력해 주세요.';
        if (value.trim().length < 10) return '메시지는 10자 이상 입력해 주세요.';
        return '';
    }
};

const FIELD_NAMES = Object.keys(validators);

function setFieldError(fieldName, message) {
    setState('form', { errors: { ...state.form.errors, [fieldName]: message } });
}

function validateField(fieldName) {
    const input = document.querySelector(`#${fieldName}`);
    const message = validators[fieldName](input.value);
    setFieldError(fieldName, message);
    return message === '';
}

function setFormStatus(message, type) {
    formStatus.textContent = message;
    formStatus.className = `form-status${type ? ` ${type}` : ''}`;
}

/**
 * 서버 검증 결과를 화면에 반영합니다.
 * 백엔드(Formspree 등)를 붙였을 때 응답의 필드별 에러를 그대로 넘기면 됩니다.
 * 예: applyServerErrors({ email: '이미 등록된 주소입니다.' })
 */
function applyServerErrors(serverErrors = {}) {
    const merged = { ...state.form.errors };

    FIELD_NAMES.forEach((fieldName) => {
        merged[fieldName] = serverErrors[fieldName] || '';
    });

    setState('form', { errors: merged });

    const firstInvalid = FIELD_NAMES.find((fieldName) => merged[fieldName]);
    if (firstInvalid) document.querySelector(`#${firstInvalid}`).focus();
}

function handleFieldInput(event) {
    const fieldName = event.target.id;
    // 이미 에러가 떠 있는 필드만 실시간으로 다시 검사합니다.
    // 처음부터 매 글자 검사하면 입력 도중 계속 빨개져서 오히려 방해가 됩니다.
    if (state.form.errors[fieldName]) validateField(fieldName);
}

function handleFieldBlur(event) {
    validateField(event.target.id);
}

async function handleFormSubmit(event) {
    console.log('폼 제출 함수 실행됨!');
    event.preventDefault();

    const results = FIELD_NAMES.map(validateField);
    const isValid = results.every(Boolean);

    if (!isValid) {
        setFormStatus('입력값을 다시 확인해 주세요.', 'error');
        const firstInvalid = FIELD_NAMES.find((fieldName) => state.form.errors[fieldName]);
        document.querySelector(`#${firstInvalid}`).focus();
        return;
    }

    setFormStatus('전송 중...', '');

    try {
        const response = await fetch('https://formspree.io/f/xbgjpwvj', {  // ← Formspree 엔드포인트 URL로 교체
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                name: document.querySelector('#name').value,
                email: document.querySelector('#email').value,
                message: document.querySelector('#message').value
            })
        });

        if (!response.ok) {
            const result = await response.json();
            const serverErrors = result.errors || {};
            applyServerErrors(serverErrors);
            setFormStatus('입력값을 다시 확인해 주세요.', 'error');
            return;
        }

        setFormStatus('메시지가 정상적으로 접수되었습니다. 감사합니다!', 'success');
        contactForm.reset();
        setState('form', { errors: { name: '', email: '', message: '' } });
    } catch (error) {
        setFormStatus('전송에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'error');
        console.error('Form submission error:', error);
    }
}

/* =========================================================
   12. 이벤트 연결 & 초기화
   ========================================================= */
themeToggle.addEventListener('click', handleThemeToggle);

hamburger.addEventListener('click', handleHamburgerClick);
navAnchors.forEach((anchor) => anchor.addEventListener('click', handleNavLinkClick));
document.addEventListener('keydown', handleDocumentKeydown);
document.addEventListener('click', handleDocumentClick);
mobileNavQuery.addEventListener('change', handleViewportChange);

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', handleAnchorClick);
});

window.addEventListener('scroll', handleWindowScroll, { passive: true });
scrollTopBtn.addEventListener('click', handleScrollTopClick);

retryButton.addEventListener('click', loadProjects);
// 필터 버튼은 나중에 생기므로 부모에 한 번만 이벤트를 겁니다(이벤트 위임).
projectFilters.addEventListener('click', handleFilterClick);

FIELD_NAMES.forEach((fieldName) => {
    const input = document.querySelector(`#${fieldName}`);
    input.addEventListener('input', handleFieldInput);
    input.addEventListener('blur', handleFieldBlur);
});

contactForm.addEventListener('submit', handleFormSubmit);

document.querySelectorAll('main section[id]').forEach((section) => {
    sectionObserver.observe(section);
});

renderTheme();
observeReveals();
loadProjects();
