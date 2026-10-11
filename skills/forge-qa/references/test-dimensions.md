# forge-qa v3.0 — 十维测试模板参考

> **用途**：Claude 执行 forge-qa 时读取此文件，获取每个测试维度的代码模板。
> 根据项目实际情况替换选择器和断言值，不要盲目复制。
>
> **⚡ 本文件 1900+ 行，不要整读。** 先看下面的导航表，**只跳读本次 test-spec 实际用到的维度**——
> 每个维度是自足的代码模板段，互不依赖。多数项目只需要其中 3-6 个维度。

## 维度导航（按需跳读）

| 维度 | 何时需要 | 锚点 |
|---|---|---|
| D1 Console 零容忍 | **所有项目必测** | `[console]` |
| D2 数据驱动遍历 | 列表/表格/卡片流等重复渲染数据 | `[data-driven]` |
| D3 网络契约校验 | 有 API 调用 | `[network]` |
| D4 视觉规则断言 | 有 DESIGN.md token / 视觉验收项 | `[visual]` |
| D5 交互完整性 | 有表单/按钮/弹窗等交互 | `[functional]` |
| D6 响应式断点 | 需适配移动端 | `[responsive]` |
| D7 可访问性 | 键盘操作/焦点/aria 有要求 | `[accessibility]` |
| D8 SSE/流式全生命周期 | 有 SSE/流式响应（聊天、实时推送） | `[streaming]` |
| D9 URL 状态/深链 | 状态编码进 URL、可分享深链 | `[url-state]` |
| D10 懒加载/异步内容 | 无限滚动、懒加载图片、异步区块 | `[async-content]` |

> 选维度的依据是 test-spec.json，不是"能测就测"。跳读方式：在本文件搜维度锚点（如 `[network]`）。
> 底部还有「通用辅助函数」和「维度组合速查表」。

---

## 执行阶段 (Execution Phases)

测试按阶段递进执行，前一阶段全部失败时停止后续阶段：

```
Phase 1 (Smoke)    → console + 首页加载 + API 可达性    → 全部失败则中止
Phase 2 (Core)     → functional + data-driven            → P0 用例
Phase 3 (Visual)   → visual + responsive                 → P1 用例
Phase 4 (Deep)     → accessibility + 边界情况             → P2-P3 用例
```

### 阶段判定逻辑

```javascript
// Phase 1 失败 = 应用根本跑不起来，后续测试无意义
if (phase1Results.every(r => r.status === 'FAIL')) {
  collector.skip('Phase 2-4', '应用无法启动，Phase 1 全部失败');
  return collector.report();
}

// Phase 2 失败 > 50% = 核心功能严重受损，跳过视觉测试
if (phase2FailRate > 0.5) {
  collector.skip('Phase 3-4', `核心功能失败率 ${(phase2FailRate*100).toFixed(0)}%，跳过视觉和深度测试`);
  return collector.report();
}
```

---

## Dimension 1: Console Zero-Tolerance [console]

### 测试目标

监听页面所有 console.error 和未捕获异常。任何错误 = 自动 FAIL。这是最基础的健康检查，属于 Phase 1 烟雾测试。

### 能捕获的 Bug

- React/Vue render 崩溃（如 `Cannot read properties of undefined`）
- 未捕获的 Promise rejection
- 404 资源加载失败（CSS/JS/图片）
- CORS 错误
- CSP 违规

### 不能捕获的 Bug

- 静默失败（try-catch 吞掉的错误）
- 逻辑错误（渲染了错误的数据但不报错）
- 性能问题
- 视觉回归

### 代码模板

```javascript
import { chromium } from 'playwright';
// import { TestCollector, attachMonitors, snap } from '../../scripts/qa-runner.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// ── 收集器 ──
const errors = [];
const warnings = [];

page.on('console', msg => {
  if (msg.type() === 'error') {
    errors.push({ text: msg.text(), url: msg.location()?.url || '' });
  }
  // 可选：收集 warning
  if (msg.type() === 'warning' && msg.text().includes('deprecat')) {
    warnings.push(msg.text());
  }
});

page.on('pageerror', err => {
  errors.push({ text: err.message, stack: err.stack });
});

// 监听资源加载失败
page.on('response', resp => {
  if (resp.status() >= 400) {
    errors.push({ text: `HTTP ${resp.status()}: ${resp.url()}`, type: 'resource' });
  }
});

// ── 执行 ──
const BASE = 'http://127.0.0.1:8080';

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000); // 等 React hydration 完成

// 遍历主要路由/视图
const routes = ['#feed', '#channels', '#actions', '#starred'];
for (const route of routes) {
  await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
}

// ── 判定 ──
// 过滤已知无害错误（根据项目调整）
const realErrors = errors.filter(e =>
  !e.text.includes('favicon.ico') &&
  !e.text.includes('ResizeObserver loop') // Chrome 已知误报
);

if (realErrors.length > 0) {
  console.error(`FAIL: ${realErrors.length} console errors detected`);
  realErrors.forEach((e, i) => console.error(`  [${i+1}] ${e.text}`));
} else {
  console.log('PASS: Zero console errors');
}

await browser.close();
```

### 关键细节

- `ResizeObserver loop limit exceeded` 是 Chrome 常见误报，建议过滤
- `favicon.ico` 404 通常无害
- 使用 `page.on('pageerror')` 捕获未被 try-catch 包裹的异常
- 必须等 hydration 完成再检查，否则会漏掉 React 渲染期间的错误

---

## Dimension 2: Data-Driven Traversal [data-driven]

### 测试目标

不只测一张卡片，用分层抽样覆盖不同数据类型。防止"第 1 张正常、第 27 张崩溃"的问题。属于 Phase 2 核心测试。

### 能捕获的 Bug

- 数据类型不一致导致的崩溃（如某些卡片缺少 `summary` 字段）
- 特定平台/来源的渲染错误（如小红书 vs Twitter 卡片模板差异）
- 详情面板对不同数据结构的兼容性问题
- 占比 N% 的低频崩溃（只测第一张永远发现不了）

### 不能捕获的 Bug

- 数据内容正确性（需要人工审查）
- 排序/过滤逻辑错误
- 数据更新/实时性问题

### 代码模板

```javascript
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const BASE = 'http://127.0.0.1:8080';

// ── 分层抽样辅助函数 ──
function pickStratified(items, maxPerGroup = 3) {
  if (items.length === 0) return [];
  if (items.length <= maxPerGroup) return items;
  const result = [];
  result.push(items[0]);                                    // 首
  result.push(items[items.length - 1]);                     // 尾
  // 中间随机抽取
  const middle = items.slice(1, -1);
  const shuffled = middle.sort(() => Math.random() - 0.5);
  result.push(...shuffled.slice(0, maxPerGroup - 2));
  return result;
}

// ── 收集页面上所有 section 和卡片 ──
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

const errors = [];
page.on('pageerror', err => errors.push(err.message));

// 获取所有 section（根据项目实际 DOM 结构调整选择器）
const sections = await page.$$eval(
  '[data-section]',  // 替换为实际 section 选择器
  els => els.map(el => ({
    name: el.dataset.section || el.querySelector('h2')?.textContent || 'unknown',
    cardCount: el.querySelectorAll('.cursor-pointer:has(h3)').length,
  }))
);

console.log(`发现 ${sections.length} 个 section`);

// 对每个 section 进行分层抽样测试
const cardSelector = '.cursor-pointer:has(h3)'; // 替换为实际卡片选择器
const allCards = await page.$$(cardSelector);

const sampled = pickStratified(
  Array.from({ length: allCards.length }, (_, i) => i),
  Math.min(10, allCards.length) // 最多测 10 张
);

let pass = 0;
let fail = 0;

for (const idx of sampled) {
  const testId = `card-${idx}`;
  try {
    // 重新获取卡片（DOM 可能因前次操作变化）
    const cards = await page.$$(cardSelector);
    if (idx >= cards.length) continue;

    // 滚动到卡片可见
    await cards[idx].scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // 点击打开详情
    await cards[idx].click({ timeout: 5000 });
    await page.waitForTimeout(1500);

    // 验证详情面板出现（替换为实际选择器）
    const detailVisible = await page.$eval(
      '[data-detail-panel], .detail-panel, [class*="detail"]',
      el => el && el.offsetHeight > 0
    ).catch(() => false);

    if (!detailVisible) {
      throw new Error(`卡片 #${idx} 点击后详情面板未出现`);
    }

    // 验证详情面板有内容
    const hasContent = await page.$eval(
      '[data-detail-panel] h2, .detail-panel h2',
      el => el?.textContent?.trim().length > 0
    ).catch(() => false);

    if (!hasContent) {
      throw new Error(`卡片 #${idx} 详情面板无标题内容`);
    }

    // 关闭详情面板
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 验证面板已关闭
    const detailGone = await page.$eval(
      '[data-detail-panel], .detail-panel',
      el => !el || el.offsetHeight === 0
    ).catch(() => true);

    if (!detailGone) {
      throw new Error(`卡片 #${idx} Escape 后详情面板未关闭`);
    }

    pass++;
    console.log(`  PASS [${testId}]`);
  } catch (err) {
    fail++;
    console.error(`  FAIL [${testId}] ${err.message}`);
  }
}

// ── 检查遍历期间是否有 JS 错误 ──
if (errors.length > 0) {
  console.error(`遍历期间 ${errors.length} 个 JS 异常:`);
  errors.forEach(e => console.error(`  - ${e}`));
}

console.log(`\n结果: ${pass} PASS / ${fail} FAIL (共 ${sampled.length} 张卡片)`);
await browser.close();
```

### 关键细节

- **每次点击后重新 `$$()` 查询卡片**：因为 React 可能 re-render 导致旧引用失效（参考 MEMORY: stale DOM reference）
- `pickStratified` 保证覆盖首尾 + 随机中间，避免只测顺序相近的卡片
- 如果项目有多个 section/tab，需要在每个 section 内部独立抽样
- 最大抽样数建议 10-15，太多会导致测试时间过长

---

## Dimension 3: Network Contract Validation [network]

### 测试目标

验证前后端 API 契约：状态码、响应结构、SSE 端点。属于 Phase 1 烟雾测试。

### 能捕获的 Bug

- API 404（后端路由未注册或前端请求路径错误）
- 响应 JSON 结构与 ENGINEERING.md 定义不匹配
- SSE 连接失败或格式错误
- 后端未启动
- CORS 配置错误

### 不能捕获的 Bug

- 数据正确性（API 返回了符合格式但内容错误的数据）
- 竞态条件（偶发性的请求顺序问题）
- 慢查询（需要性能测试）

### 代码模板

```javascript
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const BASE = 'http://127.0.0.1:8080';

// ── API 响应收集 ──
const apiResponses = [];
const apiErrors = [];

page.on('response', async resp => {
  const url = resp.url();
  // 只关注 /api/* 请求（根据项目调整）
  if (!url.includes('/api/')) return;

  const entry = {
    url,
    status: resp.status(),
    method: resp.request().method(),
  };

  if (resp.status() >= 400) {
    apiErrors.push(entry);
    return;
  }

  // 尝试解析 JSON 响应
  try {
    const contentType = resp.headers()['content-type'] || '';
    if (contentType.includes('application/json')) {
      const body = await resp.json();
      entry.body = body;
      entry.keys = Object.keys(body);
    }
  } catch {
    entry.parseError = true;
  }

  apiResponses.push(entry);
});

// ── 触发页面加载（会发出 API 请求）──
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// ── 验证 API 状态码 ──
console.log(`\n=== API 响应汇总 ===`);
console.log(`成功请求: ${apiResponses.length}`);
console.log(`失败请求: ${apiErrors.length}`);

if (apiErrors.length > 0) {
  console.error('\nFAIL: API 错误:');
  apiErrors.forEach(e => console.error(`  ${e.method} ${e.url} → ${e.status}`));
}

// ── 验证响应结构（根据 ENGINEERING.md schema 调整）──
// 示例：验证 feed API 结构
const feedApi = apiResponses.find(r => r.url.includes('/api/feed'));
if (feedApi) {
  const requiredKeys = ['items', 'total']; // 根据 ENGINEERING.md 定义
  const missingKeys = requiredKeys.filter(k => !feedApi.keys?.includes(k));
  if (missingKeys.length > 0) {
    console.error(`FAIL: /api/feed 缺少字段: ${missingKeys.join(', ')}`);
  } else {
    console.log('PASS: /api/feed 结构符合 schema');
  }

  // 验证 items 是数组
  if (feedApi.body && !Array.isArray(feedApi.body.items)) {
    console.error('FAIL: /api/feed.items 不是数组');
  }
}

// ── SSE 端点验证 ──
async function testSSE(endpoint, timeoutMs = 5000) {
  const sseUrl = `${BASE}${endpoint}`;
  try {
    const resp = await page.request.get(sseUrl, {
      headers: { 'Accept': 'text/event-stream' },
      timeout: timeoutMs,
    });

    const contentType = resp.headers()['content-type'] || '';
    if (!contentType.includes('text/event-stream')) {
      console.error(`FAIL: SSE ${endpoint} content-type 不是 text/event-stream，实际: ${contentType}`);
      return;
    }

    const body = await resp.text();
    // SSE 格式: data: ...\n\n
    if (!body.includes('data:')) {
      console.error(`FAIL: SSE ${endpoint} 响应不包含 data: 前缀`);
      return;
    }

    console.log(`PASS: SSE ${endpoint} 格式正确`);
  } catch (err) {
    // SSE 超时是正常的（流式），检查是否至少建立了连接
    if (err.message.includes('timeout')) {
      console.log(`INFO: SSE ${endpoint} 超时（流式端点的正常行为）`);
    } else {
      console.error(`FAIL: SSE ${endpoint} 连接失败: ${err.message}`);
    }
  }
}

// 测试 SSE 端点（替换为实际路径）
// await testSSE('/api/stream');

// ── 验证后端是否运行 ──
try {
  const health = await page.request.get(`${BASE}/api/health`, { timeout: 5000 });
  if (health.ok()) {
    console.log('PASS: 后端健康检查通过');
  } else {
    console.error(`FAIL: 后端健康检查返回 ${health.status()}`);
  }
} catch {
  console.error('FAIL: 后端不可达（健康检查超时）');
}

await browser.close();
```

### 关键细节

- SSE 端点会保持连接，不要等它"完成"——设超时或只验证连接建立
- `page.on('response')` 回调中 `resp.json()` 可能失败（非 JSON 响应），必须 try-catch
- 参考 MEMORY: SSE 必须 Connection close，注意测试后清理连接

---

## Dimension 4: Visual Rule Assertions [visual]

### 测试目标

将 DESIGN.md 中的视觉规则转化为可断言的 CSS 检查。不是截图对比，而是结构化的规则验证。属于 Phase 3 视觉测试。

### 能捕获的 Bug

- 字体太小（< 12px 不可读）
- 间距不符合 4px 网格
- 平台主题色错误（如 Twitter 应该是蓝色却显示绿色）
- z-index 层叠错误

### 不能捕获的 Bug

- 美观性（需要人工判断）
- 动画流畅度
- 渐变/阴影的微妙差异
- 截图级别的像素对比

### 代码模板

```javascript
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const BASE = 'http://127.0.0.1:8080';

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

let pass = 0;
let fail = 0;

function assert(name, condition, detail = '') {
  if (condition) {
    pass++;
    console.log(`  PASS: ${name}`);
  } else {
    fail++;
    console.error(`  FAIL: ${name}${detail ? ' — ' + detail : ''}`);
  }
}

// ── 字体大小检查：所有可见文本 >= 12px ──
console.log('\n=== 字体大小 ===');
const fontSizes = await page.$$eval('body *', els =>
  els
    .filter(el => {
      const style = window.getComputedStyle(el);
      return el.offsetHeight > 0 && style.display !== 'none' && el.textContent.trim().length > 0;
    })
    .map(el => ({
      tag: el.tagName,
      text: el.textContent.trim().slice(0, 30),
      fontSize: parseFloat(window.getComputedStyle(el).fontSize),
    }))
    .filter(item => item.fontSize < 12)
);

assert(
  '最小字体 >= 12px',
  fontSizes.length === 0,
  fontSizes.length > 0
    ? `发现 ${fontSizes.length} 个元素字体 < 12px: ${fontSizes.slice(0, 3).map(f => `${f.tag}("${f.text}") = ${f.fontSize}px`).join(', ')}`
    : ''
);

// ── 4px 间距网格检查 ──
console.log('\n=== 4px 间距网格 ===');
const spacingViolations = await page.$$eval(
  '[class*="gap-"], [class*="space-"], [class*="p-"], [class*="m-"]',
  els => {
    const violations = [];
    els.forEach(el => {
      const style = window.getComputedStyle(el);
      const props = ['marginTop', 'marginBottom', 'paddingTop', 'paddingBottom', 'gap'];
      props.forEach(prop => {
        const val = parseFloat(style[prop]);
        if (val > 0 && val % 4 !== 0 && val !== 1) { // 1px border 例外
          violations.push({
            selector: el.className?.split(' ').slice(0, 2).join('.') || el.tagName,
            prop,
            value: val,
          });
        }
      });
    });
    return violations.slice(0, 10); // 最多报 10 个
  }
);

assert(
  '间距符合 4px 网格',
  spacingViolations.length === 0,
  spacingViolations.length > 0
    ? `${spacingViolations.length} 个违规: ${spacingViolations.slice(0, 3).map(v => `${v.selector}.${v.prop}=${v.value}px`).join(', ')}`
    : ''
);

// ── 平台颜色检查（根据 DESIGN.md 定义）──
console.log('\n=== 平台颜色 ===');
// 示例：定义平台 → 期望颜色的映射
const platformColors = {
  twitter:     { expected: '#1DA1F2', selector: '[data-platform="twitter"] .platform-badge' },
  xiaohongshu: { expected: '#FE2C55', selector: '[data-platform="xiaohongshu"] .platform-badge' },
  // 根据 DESIGN.md 添加更多...
};

for (const [platform, spec] of Object.entries(platformColors)) {
  const el = await page.$(spec.selector);
  if (!el) {
    console.log(`  SKIP: ${platform} 元素不存在`);
    continue;
  }
  const color = await el.evaluate(el => {
    const style = window.getComputedStyle(el);
    return style.backgroundColor || style.color;
  });
  // 颜色比较需要归一化（rgb → hex）
  assert(`${platform} 颜色`, color !== 'rgba(0, 0, 0, 0)', `实际颜色: ${color}`);
}

// ── 对比度检查（简化版）──
console.log('\n=== 文本对比度 ===');
const lowContrast = await page.$$eval('body *', els => {
  function luminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }
  function parseColor(str) {
    const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }
  function contrastRatio(fg, bg) {
    const l1 = luminance(...fg);
    const l2 = luminance(...bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  const issues = [];
  els.forEach(el => {
    if (el.offsetHeight === 0 || !el.textContent.trim()) return;
    const style = window.getComputedStyle(el);
    const fg = parseColor(style.color);
    const bg = parseColor(style.backgroundColor);
    if (fg && bg && bg[3] !== 0) { // 有明确背景色时才检查
      const ratio = contrastRatio(fg, bg);
      if (ratio < 4.5) {
        issues.push({
          text: el.textContent.trim().slice(0, 20),
          ratio: ratio.toFixed(2),
          fg: style.color,
          bg: style.backgroundColor,
        });
      }
    }
  });
  return issues.slice(0, 5);
});

assert(
  '文本对比度 >= 4.5:1',
  lowContrast.length === 0,
  lowContrast.length > 0
    ? `${lowContrast.length} 处低对比度: ${lowContrast.slice(0, 2).map(c => `"${c.text}" ratio=${c.ratio}`).join(', ')}`
    : ''
);

console.log(`\n结果: ${pass} PASS / ${fail} FAIL`);
await browser.close();
```

### 关键细节

- 颜色值需要归一化：浏览器返回 `rgb()` 格式，DESIGN.md 可能定义 hex
- `window.getComputedStyle` 返回的是计算后的值，不是源码中的 CSS 变量
- 4px 网格检查排除 1px（常用于 border），也排除 0px
- 对比度 4.5:1 是 WCAG AA 标准，大字体（>= 18px）只要 3:1

---

### 设计系统一致性（项目有 forge-design-lab 页面包时加跑）

两条命令都给 pass/fail，结果写进视觉维度：

```bash
# 1 零件库守门：本分支新增代码里不准出现模板与定制以外的颜色/字号/圆角/间距
python3 ~/.claude/skills/forge-design-lab/scripts/check_system.py <repo> --base origin/main
# 2 实现比对：骨架与真实页面同视口下逐元素比位置尺寸，误差 > 容差（默认 2px）即 fail
node ~/.claude/skills/forge-design-lab/scripts/compare_impl.mjs docs/assets/visuals/<page>/<骨架>.html \
     --app <本 worktree 的前端 URL> --json .forge/qa/impl-compare.json --shots .forge/qa/impl-shots
```

- 没有 `docs/assets/visuals/system/system.tokens.json` 就跳过 1；页面包的 tokens.json 没有 `implCheck` 就跳过 2，并在报告里写「未配置实现比对」，不算通过。
- `--app` 必须是当前 worktree 自己的前端地址（读 `.devserver.json`），不猜端口。
- 2 失败时附上两张截图与超差元素清单；是设计改了还是实现偏了，由用户在 User Gate 判断。

## Dimension 5: Interaction Completeness [functional]

### 测试目标

每个交互元素都要测试：操作 -> 状态变化 -> 可逆性。属于 Phase 2 核心测试。

### 能捕获的 Bug

- Tab 切换崩溃
- 按钮无响应
- 模态框/抽屉无法关闭
- Escape 键不生效
- aria-selected 等状态未同步

### 不能捕获的 Bug

- 业务逻辑正确性（如过滤结果是否准确）
- 并发操作冲突
- 长时间运行后的内存泄漏

### 代码模板

```javascript
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const BASE = 'http://127.0.0.1:8080';

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const errors = [];
page.on('pageerror', err => errors.push(err.message));

let pass = 0;
let fail = 0;

function assert(name, condition, detail = '') {
  if (condition) {
    pass++;
    console.log(`  PASS: ${name}`);
  } else {
    fail++;
    console.error(`  FAIL: ${name}${detail ? ' — ' + detail : ''}`);
  }
}

// ━━━ Tab 导航 ━━━
console.log('\n=== Tab 导航 ===');

// 定义所有 tab（根据项目实际调整）
const tabs = [
  { name: '推荐', selector: 'button:has-text("推荐")' },
  { name: '频道', selector: 'button:has-text("频道")' },
  { name: '行动', selector: 'button:has-text("行动")' },
  { name: '收藏', selector: 'button:has-text("收藏")' },
];

for (const tab of tabs) {
  try {
    const btn = page.locator(tab.selector).first();
    if (await btn.count() === 0) {
      console.log(`  SKIP: ${tab.name} tab 不存在`);
      continue;
    }

    await btn.click({ timeout: 3000 });
    await page.waitForTimeout(1000);

    // 验证 tab 被选中
    const isSelected = await btn.evaluate(el => {
      return el.getAttribute('aria-selected') === 'true' ||
             el.classList.contains('active') ||
             el.dataset.state === 'active';
    });
    assert(`${tab.name} tab 可点击且被选中`, isSelected);

    // 验证对应面板可见
    const hasContent = await page.$eval('main, [role="tabpanel"], .content-area', el =>
      el && el.offsetHeight > 0
    ).catch(() => false);
    assert(`${tab.name} tab 内容面板可见`, hasContent);

  } catch (err) {
    fail++;
    console.error(`  FAIL: ${tab.name} tab — ${err.message}`);
  }
}

// ━━━ 详情面板：打开 / 内容 / 关闭 ━━━
console.log('\n=== 详情面板 ===');

// 先回到首页
await page.locator(tabs[0].selector).first().click();
await page.waitForTimeout(1000);

const firstCard = page.locator('.cursor-pointer:has(h3)').first();
if (await firstCard.count() > 0) {
  // 打开
  await firstCard.click({ timeout: 5000 });
  await page.waitForTimeout(1500);

  const panelVisible = await page.$eval(
    '[data-detail-panel], .detail-panel, [class*="detail"]',
    el => el && el.offsetHeight > 0
  ).catch(() => false);
  assert('详情面板打开', panelVisible);

  // 内容非空
  const panelHasContent = await page.$$eval(
    '[data-detail-panel] *, .detail-panel *',
    els => els.some(el => el.textContent.trim().length > 10)
  ).catch(() => false);
  assert('详情面板有内容', panelHasContent);

  // Escape 关闭
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  const panelGone = await page.$eval(
    '[data-detail-panel], .detail-panel',
    el => !el || el.offsetHeight === 0 || el.getAttribute('aria-hidden') === 'true'
  ).catch(() => true); // 元素不存在 = 已关闭
  assert('Escape 关闭详情面板', panelGone);
} else {
  console.log('  SKIP: 无卡片可测试');
}

// ━━━ 展开/收起 ━━━
console.log('\n=== 展开/收起 ===');

const expandBtn = page.locator('button:has-text("展开"), button:has-text("更多")').first();
if (await expandBtn.count() > 0) {
  await expandBtn.scrollIntoViewIfNeeded();

  // 记录展开前高度
  const beforeHeight = await expandBtn.evaluate(el => {
    const section = el.closest('section') || el.parentElement;
    return section?.scrollHeight || 0;
  });

  await expandBtn.click({ timeout: 3000 });
  await page.waitForTimeout(800);

  const afterHeight = await expandBtn.evaluate(el => {
    const section = el.closest('section') || el.parentElement;
    return section?.scrollHeight || 0;
  });
  assert('展开按钮增加了内容高度', afterHeight >= beforeHeight);

  // 收起
  const collapseBtn = page.locator('button:has-text("收起"), button:has-text("折叠")').first();
  if (await collapseBtn.count() > 0) {
    await collapseBtn.click({ timeout: 3000 });
    await page.waitForTimeout(800);
    assert('收起按钮存在且可点击', true);
  }
} else {
  console.log('  SKIP: 无展开按钮');
}

// ━━━ 遍历期间无 JS 错误 ━━━
console.log('\n=== 交互期间稳定性 ===');
assert('交互期间零 JS 异常', errors.length === 0,
  errors.length > 0 ? `${errors.length} 个异常: ${errors[0]}` : '');

console.log(`\n结果: ${pass} PASS / ${fail} FAIL`);
await browser.close();
```

### 关键细节

- Tab 选中状态检查三种常见模式：`aria-selected`、`.active` class、`data-state`
- 详情面板关闭判定：元素消失 OR `offsetHeight === 0` OR `aria-hidden === "true"`
- 展开/收起用 `scrollHeight` 比较，比检查 class 更可靠
- 所有操作后检查 `pageerror` 收集器——交互触发的崩溃最有价值

---

## Dimension 6: Responsive Breakpoints [responsive]

### 测试目标

三个断点下验证布局完整性：mobile(375px)、tablet(768px)、desktop(1440px)。属于 Phase 3 视觉测试。

### 能捕获的 Bug

- 水平溢出（出现横向滚动条）
- 触摸目标太小（< 44px，移动端难以点击）
- 布局错乱（元素重叠或溢出容器）
- 文字截断不当

### 不能捕获的 Bug

- 实际设备差异（浏览器引擎差异、刘海屏等）
- 手势交互（滑动、双指缩放）
- 系统级 UI 遮挡（键盘弹出、状态栏）

### 代码模板

```javascript
import { chromium } from 'playwright';

const browser = await chromium.launch();
const BASE = 'http://127.0.0.1:8080';

const breakpoints = [
  { name: 'mobile',  width: 375,  height: 812 },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

let totalPass = 0;
let totalFail = 0;

for (const bp of breakpoints) {
  console.log(`\n━━━ ${bp.name} (${bp.width}x${bp.height}) ━━━`);

  const page = await browser.newPage({ viewport: { width: bp.width, height: bp.height } });
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  let pass = 0;
  let fail = 0;

  function assert(name, condition, detail = '') {
    if (condition) { pass++; console.log(`  PASS: ${name}`); }
    else { fail++; console.error(`  FAIL: ${name}${detail ? ' — ' + detail : ''}`); }
  }

  // ── 水平溢出检查 ──
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  assert('无水平溢出', !hasOverflow,
    hasOverflow ? `scrollWidth=${await page.evaluate(() => document.documentElement.scrollWidth)}, clientWidth=${bp.width}` : '');

  // ── 触摸目标 >= 44px（仅 mobile + tablet）──
  if (bp.width <= 768) {
    const smallTargets = await page.$$eval(
      'button, a, [role="button"], input, select, [onclick]',
      els => {
        return els
          .filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 &&
                   (rect.width < 44 || rect.height < 44);
          })
          .map(el => ({
            tag: el.tagName,
            text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20),
            width: Math.round(el.getBoundingClientRect().width),
            height: Math.round(el.getBoundingClientRect().height),
          }))
          .slice(0, 10);
      }
    );

    assert(
      '触摸目标 >= 44px',
      smallTargets.length === 0,
      smallTargets.length > 0
        ? `${smallTargets.length} 个过小: ${smallTargets.slice(0, 3).map(t => `${t.tag}("${t.text}") ${t.width}x${t.height}`).join(', ')}`
        : ''
    );
  }

  // ── 元素溢出容器检查 ──
  const overflowingElements = await page.$$eval('body *', els => {
    const issues = [];
    els.forEach(el => {
      if (el.offsetHeight === 0) return;
      const rect = el.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      if (rect.right > viewportWidth + 2) { // 2px 容差
        issues.push({
          tag: el.tagName,
          class: (el.className || '').toString().split(' ').slice(0, 2).join(' '),
          right: Math.round(rect.right),
          viewport: viewportWidth,
        });
      }
    });
    return issues.slice(0, 5);
  });

  assert(
    '所有元素在视口内',
    overflowingElements.length === 0,
    overflowingElements.length > 0
      ? `${overflowingElements.length} 个溢出: ${overflowingElements.slice(0, 2).map(e => `${e.tag}.${e.class} right=${e.right}`).join(', ')}`
      : ''
  );

  // ── 文字截断检查（重要元素不应出现 text-overflow: ellipsis + 实际截断）──
  const truncatedTexts = await page.$$eval('h1, h2, h3, [class*="title"]', els =>
    els.filter(el => {
      const style = window.getComputedStyle(el);
      return style.textOverflow === 'ellipsis' &&
             style.overflow === 'hidden' &&
             el.scrollWidth > el.clientWidth;
    }).map(el => ({
      tag: el.tagName,
      text: el.textContent.trim().slice(0, 30),
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
    })).slice(0, 5)
  );

  if (truncatedTexts.length > 0) {
    console.log(`  INFO: ${truncatedTexts.length} 个标题被截断（可能是设计意图）:`);
    truncatedTexts.forEach(t => console.log(`    ${t.tag}: "${t.text}..." (${t.scrollW} > ${t.clientW})`));
  }

  // ── 截图存证 ──
  // const OUT = '/path/to/qa_screenshots';
  // await page.screenshot({ path: `${OUT}/responsive_${bp.name}.png`, fullPage: false });

  totalPass += pass;
  totalFail += fail;
  console.log(`  小计: ${pass} PASS / ${fail} FAIL`);

  await page.close();
}

console.log(`\n总计: ${totalPass} PASS / ${totalFail} FAIL (across ${breakpoints.length} breakpoints)`);
await browser.close();
```

### 关键细节

- 每个断点用独立 `page` 实例，避免 `setViewportSize` 后 CSS media query 不更新
- 触摸目标 44px 是 Apple HIG 标准，仅在 mobile/tablet 断点检查
- 水平溢出检查 `scrollWidth > clientWidth`，2px 容差防止 subpixel 误报
- 文字截断是 INFO 不是 FAIL——可能是设计意图（单行标题截断显示省略号）

---

## Dimension 7: Accessibility [accessibility]

### 测试目标

WCAG 2.0 AA 合规性扫描 + 键盘导航测试。属于 Phase 4 深度测试。

### 能捕获的 Bug

- 缺少 alt 文本
- 表单缺少 label
- 低对比度
- 键盘陷阱（Tab 进去出不来）
- 缺少 ARIA 属性
- 不正确的 heading 层级

### 不能捕获的 Bug

- 屏幕阅读器的实际朗读体验
- 认知可访问性（内容是否易懂）
- 动画敏感性（前庭障碍）

### 代码模板

```javascript
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const BASE = 'http://127.0.0.1:8080';

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

let pass = 0;
let fail = 0;

function assert(name, condition, detail = '') {
  if (condition) { pass++; console.log(`  PASS: ${name}`); }
  else { fail++; console.error(`  FAIL: ${name}${detail ? ' — ' + detail : ''}`); }
}

// ━━━ axe-core 扫描 ━━━
console.log('\n=== axe-core WCAG 2.0 AA ===');

// 注入 axe-core（CDN 或本地文件）
await page.addScriptTag({
  url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js',
});
await page.waitForTimeout(1000);

const axeResults = await page.evaluate(async () => {
  if (typeof axe === 'undefined') return { error: 'axe-core 加载失败' };
  const results = await axe.run(document, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa'],
    },
  });
  return {
    violations: results.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      count: v.nodes.length,
      nodes: v.nodes.slice(0, 3).map(n => n.html.slice(0, 80)),
    })),
    passes: results.passes.length,
    incomplete: results.incomplete.length,
  };
});

if (axeResults.error) {
  console.error(`  SKIP: ${axeResults.error}`);
} else {
  const critical = axeResults.violations.filter(v => v.impact === 'critical');
  const serious = axeResults.violations.filter(v => v.impact === 'serious');
  const moderate = axeResults.violations.filter(v => v.impact === 'moderate');
  const minor = axeResults.violations.filter(v => v.impact === 'minor');

  console.log(`  通过: ${axeResults.passes} 条规则`);
  console.log(`  违规: critical=${critical.length}, serious=${serious.length}, moderate=${moderate.length}, minor=${minor.length}`);

  assert('无 critical/serious 级别违规', critical.length + serious.length === 0);

  // 打印所有违规详情
  axeResults.violations.forEach(v => {
    console.log(`  [${v.impact}] ${v.id}: ${v.description} (${v.count} 处)`);
    v.nodes.forEach(html => console.log(`    → ${html}`));
  });
}

// ━━━ 键盘导航 ━━━
console.log('\n=== 键盘导航 ===');

// Tab 遍历：检查 focus 可达性
const focusableElements = await page.$$eval(
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
  els => els.filter(el => el.offsetHeight > 0).length
);
console.log(`  可聚焦元素: ${focusableElements} 个`);

// Tab 前进测试
const visitedTags = [];
const MAX_TABS = Math.min(focusableElements, 20); // 最多按 20 次 Tab

for (let i = 0; i < MAX_TABS; i++) {
  await page.keyboard.press('Tab');
  await page.waitForTimeout(100);

  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    return {
      tag: el.tagName,
      text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20),
      visible: el.offsetHeight > 0,
    };
  });

  if (focused) {
    visitedTags.push(focused);
    if (!focused.visible) {
      fail++;
      console.error(`  FAIL: Tab #${i+1} 聚焦到不可见元素: ${focused.tag}("${focused.text}")`);
    }
  }
}

assert('Tab 可遍历交互元素', visitedTags.length >= 3,
  `只访问到 ${visitedTags.length} 个元素`);

// 键盘陷阱检测：Tab 20 次后 focus 应该移动过多个不同元素
const uniqueTexts = new Set(visitedTags.map(t => t.tag + t.text));
assert('无键盘陷阱（focus 在不同元素间移动）', uniqueTexts.size >= 3,
  `${MAX_TABS} 次 Tab 只访问了 ${uniqueTexts.size} 个不同元素`);

// Enter 键激活测试
console.log('\n=== Enter 键激活 ===');
// 回到第一个按钮
await page.keyboard.press('Tab');
const activeTag = await page.evaluate(() => document.activeElement?.tagName);
if (activeTag === 'BUTTON' || activeTag === 'A') {
  // 记录当前 URL
  const beforeUrl = page.url();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  assert('Enter 键可激活聚焦的按钮/链接', true); // 不崩溃即通过
}

// Escape 键测试
console.log('\n=== Escape 键 ===');
// 打开一个模态/面板
const card = page.locator('.cursor-pointer:has(h3)').first();
if (await card.count() > 0) {
  await card.click({ timeout: 3000 });
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const panelClosed = await page.$eval(
    '[data-detail-panel], .detail-panel',
    el => !el || el.offsetHeight === 0
  ).catch(() => true);
  assert('Escape 关闭模态/面板', panelClosed);
}

// ━━━ ARIA 属性完整性 ━━━
console.log('\n=== ARIA 属性 ===');

// 图片 alt
const imgsWithoutAlt = await page.$$eval('img', imgs =>
  imgs.filter(img => img.offsetHeight > 0 && !img.alt && !img.getAttribute('aria-label') && !img.getAttribute('role'))
    .map(img => img.src.split('/').pop()?.slice(0, 30))
    .slice(0, 5)
);
assert('图片有 alt 属性', imgsWithoutAlt.length === 0,
  imgsWithoutAlt.length > 0 ? `${imgsWithoutAlt.length} 张无 alt: ${imgsWithoutAlt.join(', ')}` : '');

// 按钮有可访问名称
const unlabeledBtns = await page.$$eval('button', btns =>
  btns.filter(btn => {
    const text = btn.textContent.trim();
    const label = btn.getAttribute('aria-label');
    const title = btn.getAttribute('title');
    return btn.offsetHeight > 0 && !text && !label && !title;
  }).map(btn => btn.outerHTML.slice(0, 60)).slice(0, 5)
);
assert('按钮有可访问名称', unlabeledBtns.length === 0,
  unlabeledBtns.length > 0 ? `${unlabeledBtns.length} 个无名称: ${unlabeledBtns[0]}` : '');

// Heading 层级
const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', els =>
  els.filter(el => el.offsetHeight > 0)
    .map(el => ({ level: parseInt(el.tagName[1]), text: el.textContent.trim().slice(0, 30) }))
);
let headingOrderOk = true;
for (let i = 1; i < headings.length; i++) {
  if (headings[i].level > headings[i-1].level + 1) {
    headingOrderOk = false;
    console.error(`  INFO: Heading 跳级: h${headings[i-1].level} → h${headings[i].level} ("${headings[i].text}")`);
  }
}
assert('Heading 层级连续', headingOrderOk);

console.log(`\n结果: ${pass} PASS / ${fail} FAIL`);
await browser.close();
```

### 关键细节

- axe-core 从 CDN 注入，离线环境需改为本地路径或 npm 安装 `@axe-core/playwright`
- Tab 遍历最多 20 次，避免无限循环
- 键盘陷阱检测原理：多次 Tab 后 `uniqueTexts.size` 太小说明 focus 在原地打转
- Heading 跳级（h2 直接到 h4）是 INFO 级别，不一定是 bug 但值得注意
- `[tabindex="-1"]` 的元素排除在 Tab 遍历检查之外（它们是 programmatic focus only）

---

## Dimension 8: SSE / Streaming Full Lifecycle [streaming]

### 测试目标

验证流式数据特性（SSE、WebSocket、fetch stream）的完整生命周期：触发 → 中间态 → 数据流 → 完成 → 持久化。属于 Phase 2 核心测试，**仅当项目包含流式特性时启用**。

### 适用条件检测

```bash
# Step 0.4 中检测是否需要此维度
grep -r 'EventSource\|text/event-stream\|ReadableStream\|getReader\|WebSocket' src/ --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.py' -l 2>/dev/null
```

有结果 → 启用此维度。无结果 → 跳过。

### 能捕获的 Bug

- SSE 连接建立失败
- 流式数据中途断开无恢复
- 中间态（loading/thinking）卡死不消失
- 取消操作后 UI 残留
- 生成完成但刷新后数据丢失（持久化失败）
- 并发触发导致状态混乱

### 不能捕获的 Bug

- 流式数据内容的语义正确性（需要人工审查）
- 服务端性能问题（需要负载测试）
- 跨浏览器 SSE 兼容性差异

### 代码模板

```javascript
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const BASE = 'http://127.0.0.1:8080';

const errors = [];
page.on('pageerror', err => errors.push(err.message));

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

let pass = 0;
let fail = 0;

function assert(name, condition, detail = '') {
  if (condition) { pass++; console.log(`  PASS: ${name}`); }
  else { fail++; console.error(`  FAIL: ${name}${detail ? ' — ' + detail : ''}`); }
}

// ━━━ 阶段 1: 定位触发入口 ━━━
console.log('\n=== SSE 触发入口 ===');

// 根据项目调整：找到触发流式操作的按钮/表单
// 常见模式：生成按钮、发送按钮、提交表单
const triggerBtn = page.locator(
  'button:has-text("生成"), button:has-text("发送"), button:has-text("提交"), [data-action="generate"]'
).first();

if (await triggerBtn.count() === 0) {
  console.log('  SKIP: 未找到流式触发按钮');
} else {
  // ━━━ 阶段 2: 记录触发前状态 ━━━
  const beforeContent = await page.evaluate(() => document.body.innerText.length);
  const beforeItemCount = await page.$$eval(
    '[data-generated], .result-item, .action-item',
    els => els.length
  ).catch(() => 0);

  // ━━━ 阶段 3: 触发流式操作 ━━━
  console.log('\n=== 触发流式操作 ===');

  // 如果有前置表单（如选择生成类型），先填写
  const typeSelect = page.locator('select, [role="combobox"]').first();
  if (await typeSelect.count() > 0) {
    await typeSelect.selectOption({ index: 0 }).catch(() => {});
  }

  // 监听 SSE/fetch 请求
  let sseDetected = false;
  let streamUrl = '';
  page.on('request', req => {
    const headers = req.headers();
    if (headers['accept']?.includes('text/event-stream') ||
        req.url().includes('/stream') ||
        req.url().includes('/generate') ||
        req.url().includes('/sse')) {
      sseDetected = true;
      streamUrl = req.url();
    }
  });

  await triggerBtn.click({ timeout: 5000 });

  // ━━━ 阶段 4: 验证中间态 ━━━
  console.log('\n=== 中间态验证 ===');

  // 等待中间态出现（最多 5s）
  const loadingSelector = '.loading, .spinner, [data-state="generating"], [data-state="loading"], .animate-pulse, .thinking';
  const hasLoading = await page.locator(loadingSelector).first()
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  assert('触发后出现加载/中间态', hasLoading || sseDetected,
    '触发按钮点击后无任何加载态变化');

  // 验证触发按钮在流式期间的状态（应不可重复点击）
  if (hasLoading) {
    const btnDisabled = await triggerBtn.evaluate(el =>
      el.disabled || el.getAttribute('aria-disabled') === 'true' ||
      el.classList.contains('disabled') || el.style.pointerEvents === 'none'
    ).catch(() => false);
    assert('流式期间触发按钮不可操作', btnDisabled,
      '用户可在流式期间重复点击');
  }

  // ━━━ 阶段 5: 等待完成 ━━━
  console.log('\n=== 等待完成 ===');

  // 等待 loading 消失 或 内容区变化（最多 30s，流式操作可能较慢）
  const completed = await page.locator(loadingSelector).first()
    .waitFor({ state: 'hidden', timeout: 30000 })
    .then(() => true)
    .catch(() => false);

  // 如果 loading 指示器不消失，可能是卡死
  if (!completed) {
    const stillLoading = await page.locator(loadingSelector).first().isVisible().catch(() => false);
    assert('流式操作完成（loading 消失）', !stillLoading,
      '30s 后 loading 仍然可见，可能卡死');
  } else {
    assert('流式操作完成（loading 消失）', true);
  }

  // ━━━ 阶段 6: 验证完成态 ━━━
  console.log('\n=== 完成态验证 ===');

  const afterContent = await page.evaluate(() => document.body.innerText.length);
  assert('完成后页面内容增加', afterContent > beforeContent,
    `内容长度: 前=${beforeContent}, 后=${afterContent}`);

  // 验证生成的结果有实质内容
  const resultArea = page.locator(
    '[data-generated]:last-child, .result-item:last-child, .action-item:last-child'
  ).first();
  if (await resultArea.count() > 0) {
    const resultText = await resultArea.innerText().catch(() => '');
    assert('生成结果有实质内容', resultText.trim().length > 20,
      `结果文本长度: ${resultText.trim().length}`);
  }

  // ━━━ 阶段 7: 持久化验证（最关键）━━━
  console.log('\n=== 持久化验证 ===');

  // 刷新页面
  await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  const afterReloadCount = await page.$$eval(
    '[data-generated], .result-item, .action-item',
    els => els.length
  ).catch(() => 0);

  assert('刷新后生成内容仍然存在', afterReloadCount > beforeItemCount,
    `刷新前: ${beforeItemCount}, 刷新后: ${afterReloadCount}`);
}

// ━━━ 阶段 8（可选）: 取消/中断测试 ━━━
// 如果项目有取消按钮，测试取消后的状态恢复
// const cancelBtn = page.locator('button:has-text("取消"), button:has-text("停止")').first();
// if (await cancelBtn.count() > 0) { ... }

// ━━━ 稳定性检查 ━━━
assert('SSE 全链路无 JS 异常', errors.length === 0,
  errors.length > 0 ? `${errors.length} 个异常: ${errors[0]}` : '');

if (sseDetected) {
  console.log(`  📡 检测到 SSE 请求: ${streamUrl}`);
}

console.log(`\n结果: ${pass} PASS / ${fail} FAIL`);
await browser.close();
```

### 关键细节

- SSE 连接超时是正常的（流式端点不会主动关闭），不要把超时当 FAIL
- 持久化验证是**最关键的深层断言**——很多实现看起来流式成功了，但 reload 后数据丢失
- 取消测试需要在流式期间点击，timing 敏感——如果取消按钮闪现太快，用 `page.route` 减速
- 并发防御：快速双击触发按钮，验证不会产生两个流式请求

---

## Dimension 9: URL State / Deep Link [url-state]

### 测试目标

验证 URL 与视图状态的双向一致性：UI 操作驱动 URL 更新（正向），直接访问 URL 恢复视图状态（反向）。属于 Phase 2 核心测试，**仅当项目使用 URL 管理状态时启用**。

### 适用条件检测

```bash
# Step 0.4 中检测是否需要此维度
grep -r 'useHash\|useRouter\|useSearchParams\|history\.pushState\|window\.location\.hash\|react-router\|vue-router\|next/router' src/ --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' -l 2>/dev/null
```

有结果 → 启用此维度。

### 能捕获的 Bug

- Tab/视图切换后 URL 不更新
- 直接访问深度链接白屏或状态丢失
- 浏览器前进/后退导致状态不一致
- 无效参数导致崩溃（而非优雅降级）
- URL 参数编码问题（中文、特殊字符）

### 不能捕获的 Bug

- SEO/SSR 相关的 URL 问题
- 服务端路由重定向逻辑
- URL 美观性/规范性

### 代码模板

```javascript
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const BASE = 'http://127.0.0.1:8080';

const errors = [];
page.on('pageerror', err => errors.push(err.message));

let pass = 0;
let fail = 0;

function assert(name, condition, detail = '') {
  if (condition) { pass++; console.log(`  PASS: ${name}`); }
  else { fail++; console.error(`  FAIL: ${name}${detail ? ' — ' + detail : ''}`); }
}

// ━━━ 正向测试：UI 操作 → URL 变化 ━━━
console.log('\n=== 正向：操作 → URL ===');

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const initialUrl = page.url();
console.log(`  初始 URL: ${initialUrl}`);

// 找到所有导航元素（Tab/频道/菜单）
const navItems = await page.$$eval(
  'nav button, nav a, [role="tab"], [data-nav]',
  els => els.map(el => ({
    text: el.textContent.trim().slice(0, 20),
    tag: el.tagName,
  })).filter(e => e.text.length > 0)
);
console.log(`  发现 ${navItems.length} 个导航元素`);

// 点击每个导航元素，检查 URL 是否变化
const navButtons = page.locator('nav button, nav a, [role="tab"], [data-nav]');
const navCount = Math.min(await navButtons.count(), 5); // 最多测 5 个

const urlChanges = [];
for (let i = 0; i < navCount; i++) {
  const btn = navButtons.nth(i);
  const label = await btn.innerText().catch(() => `nav-${i}`);
  const urlBefore = page.url();

  await btn.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const urlAfter = page.url();
  const changed = urlAfter !== urlBefore;
  urlChanges.push({ label: label.trim(), urlBefore, urlAfter, changed });

  if (changed) {
    console.log(`  📍 "${label.trim()}" → URL 变为 ${urlAfter}`);
  }
}

const anyUrlChanged = urlChanges.some(u => u.changed);
assert('导航操作至少有一个更新了 URL', anyUrlChanged,
  '所有导航点击后 URL 均未变化');

// ━━━ 反向测试：URL → 视图恢复 ━━━
console.log('\n=== 反向：URL → 视图恢复 ===');

// 用正向收集到的 URL 做反向测试
const urlsToTest = urlChanges.filter(u => u.changed);

for (const { label, urlAfter } of urlsToTest) {
  // 先回首页清空状态
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  // 直接访问目标 URL
  await page.goto(urlAfter, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  // 验证视图恢复：页面有内容且无崩溃
  const hasContent = await page.evaluate(() =>
    document.querySelector('main, [role="main"], .content-area')?.innerText?.trim().length > 0
  ).catch(() => false);

  assert(`深度链接 "${label}" 视图正确恢复`, hasContent,
    `直接访问 ${urlAfter} 后内容区为空`);

  // 验证无新增 console 错误
  const newErrors = errors.filter(e => !e._checked);
  if (newErrors.length > 0) {
    newErrors.forEach(e => e._checked = true);
    fail++;
    console.error(`  FAIL: 深度链接 "${label}" 触发 JS 错误: ${newErrors[0]}`);
  }
}

// ━━━ 详情深度链接测试 ━━━
console.log('\n=== 详情项深度链接 ===');

// 回首页，点击一个条目获取详情 URL
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2000);

const firstCard = page.locator('.cursor-pointer:has(h3)').first();
if (await firstCard.count() > 0) {
  await firstCard.click({ timeout: 5000 });
  await page.waitForTimeout(1500);

  const detailUrl = page.url();
  const hasDetailParam = detailUrl !== BASE && detailUrl !== `${BASE}/`;

  if (hasDetailParam) {
    // 新标签页直接访问详情 URL
    const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page2.goto(detailUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page2.waitForTimeout(3000);

    // 验证详情面板自动打开
    const detailVisible = await page2.evaluate(() => {
      const panel = document.querySelector('[role="dialog"], [class*="detail"], [class*="modal"]');
      return panel && panel.offsetHeight > 0;
    }).catch(() => false);

    assert('详情深度链接自动打开面板', detailVisible,
      `直接访问 ${detailUrl} 但详情面板未打开`);

    if (detailVisible) {
      const hasDetailContent = await page2.evaluate(() => {
        const panel = document.querySelector('[role="dialog"], [class*="detail"]');
        return panel?.innerText?.trim().length > 50;
      }).catch(() => false);

      assert('详情面板内容完整', hasDetailContent);
    }

    await page2.close();
  } else {
    console.log('  INFO: 点击条目后 URL 未变化（项目可能不支持详情深度链接）');
  }
}

// ━━━ 浏览器前进/后退 ━━━
console.log('\n=== 前进/后退 ===');

if (urlsToTest.length >= 2) {
  // 依次访问两个不同 URL
  await page.goto(urlsToTest[0].urlAfter, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  const firstState = await page.evaluate(() => document.querySelector('main')?.innerText?.slice(0, 50) || '');

  await page.goto(urlsToTest[1].urlAfter, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  // 后退
  await page.goBack();
  await page.waitForTimeout(2000);

  const backUrl = page.url();
  assert('后退恢复到前一个 URL', backUrl.includes(new URL(urlsToTest[0].urlAfter).hash || '') ||
    backUrl === urlsToTest[0].urlAfter);

  // 前进
  await page.goForward();
  await page.waitForTimeout(2000);

  const forwardUrl = page.url();
  assert('前进恢复到后一个 URL', forwardUrl.includes(new URL(urlsToTest[1].urlAfter).hash || '') ||
    forwardUrl === urlsToTest[1].urlAfter);
}

// ━━━ 边界：无效参数 ━━━
console.log('\n=== 无效 URL 参数 ===');

const invalidUrls = [
  `${BASE}/#nonexistent-view`,
  `${BASE}/#d=invalid-item-id-12345`,
  `${BASE}/?tab=doesnotexist`,
];

for (const invalidUrl of invalidUrls) {
  const errorsBefore = errors.length;
  await page.goto(invalidUrl, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // 不应白屏
  const bodyText = await page.evaluate(() => document.body.innerText.trim().length).catch(() => 0);
  assert(`无效 URL 不白屏: ${invalidUrl.replace(BASE, '')}`, bodyText > 10,
    `页面文本长度: ${bodyText}`);
}

assert('URL 测试全程无 JS 异常', errors.filter(e => !e._checked).length === 0,
  errors.filter(e => !e._checked).map(e => e).join('; '));

console.log(`\n结果: ${pass} PASS / ${fail} FAIL`);
await browser.close();
```

### 关键细节

- Hash 路由（`#xxx`）和 path 路由（`/xxx`）的检测方式不同——hash 变化不触发 `page.goto` 的 navigation 事件
- 反向测试必须用**全新的 page**或**先回首页**再访问，否则可能读到缓存状态
- 前进/后退在 SPA 中可能不触发完整的 page load，需要用 `waitForTimeout` + 内容检查而非 `waitForLoadState`
- URL 参数中的中文需要 encodeURIComponent，测试时注意编码一致性

---

## Dimension 10: Lazy Loading / Async Content [async-content]

### 测试目标

验证异步加载内容的完整生命周期：触发 → 加载态 → 内容到达 → 加载态消失 → 内容正确渲染。属于 Phase 2 核心测试。几乎所有 SPA 都有此需求。

### 适用条件检测

```bash
# 几乎所有项目都适用，但以下特征表明需要特别关注
grep -r 'skeleton\|loading\|spinner\|Suspense\|lazy\|useEffect.*fetch\|useSWR\|useQuery\|infinite.*scroll' src/ --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' -l 2>/dev/null
```

### 能捕获的 Bug

- 骨架屏/loading 永远不消失（请求卡死）
- 加载完成但内容为空（数据解析失败）
- 分页加载进度显示错误
- 无限滚动停止工作
- 加载失败时无错误提示（静默失败）
- 骨架屏闪烁（加载太快导致骨架屏一闪而过）

### 不能捕获的 Bug

- 数据内容正确性
- 加载性能（需要性能测试）
- 缓存策略问题

### 代码模板

```javascript
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const BASE = 'http://127.0.0.1:8080';

const errors = [];
page.on('pageerror', err => errors.push(err.message));

let pass = 0;
let fail = 0;

function assert(name, condition, detail = '') {
  if (condition) { pass++; console.log(`  PASS: ${name}`); }
  else { fail++; console.error(`  FAIL: ${name}${detail ? ' — ' + detail : ''}`); }
}

// ━━━ 首页加载：等待策略 ━━━
console.log('\n=== 首页异步加载 ===');

// 记录 API 请求
const apiResponses = [];
page.on('response', async resp => {
  if (resp.url().includes('/api/')) {
    apiResponses.push({
      url: resp.url(),
      status: resp.status(),
      timestamp: Date.now()
    });
  }
});

const loadStart = Date.now();
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });

// ❌ 不要这样等：await page.waitForTimeout(5000);
// ✅ 等待第一个有意义的内容出现
const firstContentAppeared = await page.locator(
  '.cursor-pointer:has(h3), [data-loaded], main article'
).first().waitFor({ state: 'visible', timeout: 15000 })
  .then(() => true)
  .catch(() => false);

const loadTime = Date.now() - loadStart;
assert('首屏内容在 15s 内加载', firstContentAppeared,
  `${loadTime}ms 后仍无内容`);

if (firstContentAppeared) {
  console.log(`  ⏱️  首屏内容在 ${loadTime}ms 后出现`);
}

// ━━━ 骨架屏/Loading 态验证 ━━━
console.log('\n=== 骨架屏/Loading ===');

// 检测项目是否使用骨架屏
const hasSkeleton = await page.locator(
  '.skeleton, .animate-pulse, [class*="skeleton"], [class*="loading"], .placeholder'
).first().isVisible().catch(() => false);

if (hasSkeleton) {
  // 骨架屏应该在内容加载后消失
  const skeletonGone = await page.locator('.skeleton, .animate-pulse, [class*="skeleton"]')
    .first()
    .waitFor({ state: 'hidden', timeout: 15000 })
    .then(() => true)
    .catch(() => false);

  assert('骨架屏在内容加载后消失', skeletonGone,
    '15s 后骨架屏仍然可见');
} else {
  console.log('  INFO: 未检测到骨架屏（项目可能不使用）');
}

// ━━━ 内容正确性（非空）━━━
console.log('\n=== 加载后内容验证 ===');

// 等网络空闲（所有 API 请求完成）
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(1000);

// 验证主内容区有实质内容
const mainContent = await page.evaluate(() => {
  const main = document.querySelector('main, [role="main"], .content-area, #root > div');
  if (!main) return { exists: false, textLen: 0, childCount: 0 };
  return {
    exists: true,
    textLen: main.innerText.trim().length,
    childCount: main.children.length,
  };
});

assert('主内容区存在', mainContent.exists);
assert('主内容区有实质文本', mainContent.textLen > 50,
  `文本长度: ${mainContent.textLen}`);

// ━━━ 点击后懒加载（详情/展开）━━━
console.log('\n=== 点击后懒加载 ===');

const clickable = page.locator('.cursor-pointer:has(h3)').first();
if (await clickable.count() > 0) {
  // 点击并等待 API 响应（不是 waitForTimeout）
  const apiCountBefore = apiResponses.length;

  const [response] = await Promise.all([
    // 等待详情 API 响应（适配不同项目的 API 路径）
    page.waitForResponse(
      resp => resp.url().includes('/api/') && resp.status() < 400,
      { timeout: 10000 }
    ).catch(() => null),
    clickable.click({ timeout: 5000 }),
  ]);

  await page.waitForTimeout(1000); // 等渲染完成

  if (response) {
    assert('点击后触发 API 请求', true);

    // 验证详情内容加载（不只是 panel 出现）
    const detailContent = await page.evaluate(() => {
      const panel = document.querySelector('[role="dialog"], [class*="detail"], [class*="modal"]');
      if (!panel) return { visible: false, textLen: 0 };
      return {
        visible: panel.offsetHeight > 0,
        textLen: panel.innerText.trim().length,
      };
    });

    assert('详情面板有实质内容（非空/非 loading）', detailContent.textLen > 50,
      `面板文本长度: ${detailContent.textLen}`);
  } else {
    console.log('  INFO: 点击未触发 API 请求（可能是预加载的数据）');

    // 即使没有 API 请求，面板也应有内容
    const panelVisible = await page.evaluate(() => {
      const panel = document.querySelector('[role="dialog"], [class*="detail"]');
      return panel?.offsetHeight > 0 && panel?.innerText?.trim().length > 20;
    }).catch(() => false);

    assert('预加载详情面板有内容', panelVisible);
  }

  // 关闭面板
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

// ━━━ 滚动加载/分页（如适用）━━━
console.log('\n=== 滚动/分页加载 ===');

// 记录当前条目数
const itemsBefore = await page.$$eval(
  '.cursor-pointer:has(h3), [data-item-id], .list-item',
  els => els.length
);

if (itemsBefore > 5) {
  // 滚动到底部触发加载
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);

  const itemsAfter = await page.$$eval(
    '.cursor-pointer:has(h3), [data-item-id], .list-item',
    els => els.length
  );

  if (itemsAfter > itemsBefore) {
    assert('滚动加载了更多内容', true);
    console.log(`  📊 滚动前: ${itemsBefore} 条, 滚动后: ${itemsAfter} 条`);
  } else {
    console.log(`  INFO: 滚动未加载更多（可能已全部加载，当前 ${itemsBefore} 条）`);
  }
}

// ━━━ 进度指示器（如适用）━━━
const progressText = await page.locator(
  '[class*="progress"], [class*="loading-text"], .status-text'
).first().innerText().catch(() => '');

if (progressText) {
  console.log(`  📊 进度文本: "${progressText}"`);
  // 如果有进度，等待加载完成后验证进度消失
  await page.waitForTimeout(5000);
  const progressGone = await page.locator(
    '[class*="progress"], [class*="loading-text"]'
  ).first().isVisible().catch(() => false);

  if (progressGone) {
    console.log('  INFO: 5s 后进度仍在显示（数据量大时正常）');
  }
}

// ━━━ API 加载失败模拟（可选）━━━
// 通过 route 拦截模拟 API 失败，验证错误处理
// await page.route('**/api/**', route => route.abort());
// await page.reload();
// const errorMessage = await page.locator('.error, [class*="error"]').first().isVisible();
// assert('API 失败时显示错误提示', errorMessage);

// ━━━ 稳定性 ━━━
assert('异步加载全程无 JS 异常', errors.length === 0,
  errors.length > 0 ? `${errors.length} 个异常: ${errors[0]}` : '');

console.log(`\n结果: ${pass} PASS / ${fail} FAIL`);
console.log(`📡 共 ${apiResponses.length} 个 API 请求`);
await browser.close();
```

### 关键细节

- **永远不要用 `waitForTimeout` 作为主要等待策略**——用 `waitForResponse`、`waitForSelector`、`waitForLoadState`
- 骨架屏检测用 `.skeleton`、`.animate-pulse`（Tailwind）、`[class*="skeleton"]`
- 分页/无限滚动测试：记录条目数 → 滚动 → 等待 → 再记录，比较增量
- 如果项目有进度指示器（如"加载中 500/10740"），验证格式但不 fail——大数据集加载慢是正常的
- 错误态测试（API 失败模拟）标记为可选——它需要 `page.route` 拦截，可能影响其他测试

---

## 通用辅助函数

以下辅助函数可在任何维度中复用：

```javascript
// ── 截图存证 ──
async function snap(page, name, outDir) {
  const path = `${outDir}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`  📸 ${path}`);
  return path;
}

// ── 等待内容加载（骨架屏消失 + 实际内容出现）──
async function waitForContent(page, timeout = 8000) {
  try {
    await page.waitForSelector('.cursor-pointer, [data-loaded], main *:not(.skeleton)', { timeout });
  } catch { /* timeout ok */ }
  await page.waitForTimeout(1000);
}

// ── 分层抽样 ──
function pickStratified(items, maxPerGroup = 3) {
  if (items.length <= maxPerGroup) return [...items];
  const result = [items[0], items[items.length - 1]];
  const middle = items.slice(1, -1).sort(() => Math.random() - 0.5);
  result.push(...middle.slice(0, maxPerGroup - 2));
  return result;
}

// ── RGB 字符串转 Hex ──
function rgbToHex(rgb) {
  const m = rgb.match(/(\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return rgb;
  return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// ── 安全点击（滚动到可见 + 重试）──
async function safeClick(page, selector, timeout = 5000) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  await el.click({ timeout });
  await page.waitForTimeout(500);
}
```

---

## 维度组合速查表

| 阶段 | 维度 | 标识 | 耗时 | 优先级 | 启用条件 |
|------|------|------|------|--------|---------|
| Phase 1 | Console Zero-Tolerance | `[console]` | ~10s | P0 | 始终 |
| Phase 1 | Network Contract | `[network]` | ~15s | P0 | 始终 |
| Phase 2 | Interaction Completeness | `[functional]` | ~30s | P0 | 始终 |
| Phase 2 | Data-Driven Traversal | `[data-driven]` | ~45s | P0 | 有列表/卡片 |
| Phase 2 | SSE / Streaming | `[streaming]` | ~60s | P0 | 有 SSE/WebSocket/stream |
| Phase 2 | URL State / Deep Link | `[url-state]` | ~40s | P0 | 有路由/hash 状态 |
| Phase 2 | Lazy Loading / Async | `[async-content]` | ~30s | P0 | 有异步加载（几乎所有 SPA） |
| Phase 3 | Visual Rule Assertions | `[visual]` | ~20s | P1 | 有 DESIGN.md |
| Phase 3 | Responsive Breakpoints | `[responsive]` | ~40s | P1 | 有移动端需求 |
| Phase 4 | Accessibility | `[accessibility]` | ~30s | P2 | 始终（可降级） |

**总预估时间**：~5 分钟（全部 10 维度顺序执行，实际按适用条件启用）
