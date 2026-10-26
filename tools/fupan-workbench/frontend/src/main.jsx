import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { marked } from 'marked';
import './styles.css';

const DEPTHS = [
  { value: '了解', hint: '知道它是什么' },
  { value: '表达', hint: '会用关键词指挥 AI' },
  { value: '复现', hint: '能复述和自己做一遍' },
];
const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';
const SHANGHAI_DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  timeZone: SHANGHAI_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const DOMAIN_LABELS = {
  'ai-collab': 'AI 协作',
  tech: '技术',
  product: '产品',
  expression: '表达',
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

function sanitize(html) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

function formatDateParts(date) {
  const parts = Object.fromEntries(SHANGHAI_DATE_FORMATTER.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function formatDate(value) {
  if (!value) return '未知日期';
  const text = String(value).trim();
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;

  const localWallTime = text.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  if (hasExplicitZone) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return formatDateParts(date);
  }
  if (localWallTime) {
    return `${localWallTime[1]}-${localWallTime[2]}-${localWallTime[3]} ${localWallTime[4]}:${localWallTime[5]}`;
  }

  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? text : formatDateParts(fallback);
}

function countLabel(count, unit) {
  return `${count} ${unit}`;
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildHeadingId(title, index, counts) {
  const normalized = String(title || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  const base = normalized || `section-${index + 1}`;
  const count = (counts.get(base) || 0) + 1;
  counts.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
}

function buildHeadingItems(headings = []) {
  const counts = new Map();
  return headings
    .filter((heading) => heading.level >= 1 && heading.level <= 3)
    .map((heading, index) => ({
      ...heading,
      id: buildHeadingId(heading.title, index, counts),
    }));
}

function normalizeHeadingText(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function stripDuplicateTitle(content, title) {
  const match = String(content || '').match(/^\s*#\s+(.+?)\s*(?:\n|$)/);
  if (!match || normalizeHeadingText(match[1]) !== normalizeHeadingText(title)) {
    return { content: content || '', stripped: false };
  }
  return {
    content: String(content || '').slice(match[0].length).replace(/^\n+/, ''),
    stripped: true,
  };
}

function renderMarkdown(content, headingItems) {
  const renderer = new marked.Renderer();
  let headingIndex = 0;
  renderer.heading = (text, level) => {
    if (level >= 1 && level <= 3) {
      const item = headingItems[headingIndex];
      headingIndex += 1;
      const id = item?.id ? ` id="${escapeAttribute(item.id)}"` : '';
      return `<h${level}${id}>${text}</h${level}>\n`;
    }
    return `<h${level}>${text}</h${level}>\n`;
  };
  renderer.image = (href, title, text) => {
    if (!href) return '';
    const src = escapeAttribute(href);
    const alt = escapeAttribute(text || '复盘图片');
    const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : '';
    return (
      `<button type="button" class="markdown-image-button" data-zoom-src="${src}" data-zoom-alt="${alt}" aria-label="放大图片：${alt}">` +
      `<img src="${src}" alt="${alt}"${titleAttribute}>` +
      '</button>'
    );
  };
  return sanitize(marked.parse(content || '', { renderer }));
}

function normalizeQuoteItems(items = []) {
  return items
    .map((item) => {
      if (typeof item === 'string') {
        return { quote: item, issue: '', suggestion: '' };
      }
      return {
        quote: item?.quote || item?.text || '',
        issue: item?.issue || item?.reason || '',
        suggestion: item?.suggestion || item?.better_prompt || '',
      };
    })
    .filter((item) => item.quote);
}

const STATUS_LABELS = {
  pending_selection: '待确认',
  submitted: '生成中',
  consumed: '已完成',
  failed: '失败',
};

function StatusPill({ status, active }) {
  const label = STATUS_LABELS[status] || status;
  return <span className={`status status-${status || 'unknown'} ${active ? 'status-current' : ''}`}>{label}</span>;
}

function App() {
  const path = window.location.pathname;

  if (path.startsWith('/review/')) {
    return <ReviewDetail reviewId={decodeURIComponent(path.replace('/review/', ''))} />;
  }
  if (path.startsWith('/session/')) {
    return <SessionPage taskId={decodeURIComponent(path.replace('/session/', ''))} />;
  }
  return <Home />;
}

function Home() {
  const [tab, setTab] = useState('sessions');

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">复盘工作台</p>
          <h1>Fupan Workbench</h1>
        </div>
        <nav className="tab-bar" aria-label="页面切换">
          <button className={`tab-button ${tab === 'sessions' ? 'tab-active' : ''}`} onClick={() => setTab('sessions')}>
            🗂 复盘会话
          </button>
          <button className={`tab-button ${tab === 'ledger' ? 'tab-active' : ''}`} onClick={() => setTab('ledger')}>
            📒 教训账本
          </button>
          <button className={`tab-button ${tab === 'reviews' ? 'tab-active' : ''}`} onClick={() => setTab('reviews')}>
            📄 复盘文档
          </button>
        </nav>
      </header>
      {tab === 'sessions' && <SessionsSection />}
      {tab === 'ledger' && <LedgerSection />}
      {tab === 'reviews' && <ReviewsSection />}
    </main>
  );
}

function SessionsSection() {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    function load() {
      api('/api/tasks')
        .then((data) => alive && setTasks(data.tasks || []))
        .catch((err) => alive && setError(err.message));
    }
    load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (error) return <div className="inline-error">会话列表读取失败：{error}</div>;
  if (!tasks) return <EmptyState text="正在读取复盘会话。" />;

  const open = tasks.filter((task) => task.status === 'pending_selection' || task.status === 'submitted');
  const done = tasks.filter((task) => task.status !== 'pending_selection' && task.status !== 'submitted');

  return (
    <>
      <section className="panel task-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">等待你确认或正在生成</p>
            <h2>进行中</h2>
          </div>
          <span className="mono">{countLabel(open.length, '个会话')}</span>
        </div>
        {open.length ? <SessionList tasks={open} /> : <EmptyState text="没有进行中的复盘。在对话里说「复盘」就会出现新会话。" />}
      </section>
      <section className="panel history-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">全部历史会话</p>
            <h2>历史 Workbench</h2>
          </div>
          <span className="mono">{countLabel(done.length, '个会话')}</span>
        </div>
        {done.length ? <SessionList tasks={done} /> : <EmptyState text="还没有历史复盘会话。" />}
      </section>
    </>
  );
}

function SessionList({ tasks }) {
  return (
    <div className="task-queue">
      {tasks.map((task) => (
        <a className="queue-row" key={task.id} href={`/session/${encodeURIComponent(task.id)}`}>
          <StatusPill status={task.status} active={task.active} />
          <span className="queue-title">{task.title || task.summary || task.project || task.id}</span>
          <span className="queue-project">{task.project}</span>
          <span className="mono">{formatDate(task.created_at)}</span>
        </a>
      ))}
    </div>
  );
}

function SessionPage({ taskId }) {
  const [task, setTask] = useState(null);
  const [error, setError] = useState('');
  const taskRef = useRef(null);
  taskRef.current = task;

  const load = useCallback(() => {
    api(`/api/tasks/${encodeURIComponent(taskId)}`)
      .then((data) => {
        setTask(data);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, [taskId]);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      const status = taskRef.current?.status;
      if (!status || status === 'pending_selection' || status === 'submitted') load();
    }, 3000);
    return () => clearInterval(timer);
  }, [load]);

  if (error) {
    return (
      <main className="detail-shell">
        <a className="back-link" href="/">返回工作台</a>
        <div className="inline-error">会话读取失败：{error}</div>
      </main>
    );
  }
  if (!task) {
    return (
      <main className="detail-shell">
        <a className="back-link" href="/">返回工作台</a>
        <EmptyState text="正在读取复盘会话。" />
      </main>
    );
  }

  const quotes = normalizeQuoteItems(task.expression_issue_quotes || []);
  const issueQuoteSet = new Set(quotes.map((item) => item.quote));
  const contextQuestions = (task.user_questions || []).filter((question) => !issueQuoteSet.has(question));

  return (
    <main className="detail-shell">
      <header className="detail-top">
        <a className="back-link" href="/">返回工作台</a>
        <span className="mono">{task.project} / {formatDate(task.created_at)}</span>
      </header>
      <section className="panel session-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">复盘会话 {task.id}</p>
            <h1>{task.title || task.summary || '待确认复盘'}</h1>
            {task.title && task.summary && <p className="session-summary">{task.summary}</p>}
          </div>
          <StatusPill status={task.status} active={task.active} />
        </div>
        {(quotes.length > 0 || contextQuestions.length > 0) && (
          <div className="question-box">
            {quotes.length > 0 && (
              <section className="quote-group quote-group-issue">
                <p className="small-title">表达待优化原话</p>
                <p className="quote-note">AI 从本次会话自行判断，把影响沟通效率的原话完整摘出来。</p>
                <ul className="quote-list">
                  {quotes.map((item, index) => (
                    <li key={`${item.quote}-${index}`}>
                      <blockquote>{item.quote}</blockquote>
                      {item.issue && <p className="quote-meta">问题：{item.issue}</p>}
                      {item.suggestion && <p className="quote-meta">下次可以说：{item.suggestion}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {contextQuestions.length > 0 && (
              <section className="quote-group">
                <p className="small-title">{quotes.length ? '背景原话摘录' : '用户原话摘录'}</p>
                {contextQuestions.map((question, index) => (
                  <p className="quote-line" key={`${question}-${index}`}>{question}</p>
                ))}
              </section>
            )}
          </div>
        )}
        {task.status === 'pending_selection' && <TaskForm task={task} onSubmitted={setTask} />}
        {task.status === 'submitted' && (
          <>
            <SelectionSummary task={task} />
            <div className="waiting-note">已提交。AI 正在按你的选择调研写作，文档生成后这里会出现入口，页面会自动刷新。</div>
          </>
        )}
        {task.status === 'consumed' && (
          <>
            <SelectionSummary task={task} />
            {task.review_id ? (
              <a className="button button-primary review-jump" href={`/review/${encodeURIComponent(task.review_id)}`}>
                打开这次的复盘文档 →
              </a>
            ) : (
              <div className="waiting-note">复盘文档已生成，但没有登记路径。可去「复盘文档」页按日期查找。</div>
            )}
          </>
        )}
        {task.status === 'failed' && (
          <div className="inline-error">这次会话标记为失败：{task.error || '未记录原因'}。可以在对话里重新发起复盘。</div>
        )}
      </section>
    </main>
  );
}

function SelectionSummary({ task }) {
  const chosen = (task.selection?.topics || []).filter((topic) => topic.selected !== false);
  return (
    <div className="selection-summary">
      <p className="small-title">你的学习选择（{formatDate(task.selection?.submitted_at)} 提交）</p>
      {chosen.length ? (
        <ul className="selection-list">
          {chosen.map((topic) => (
            <li key={topic.id}>
              <strong>{topic.title || topic.id}</strong>
              <span className="mono">{topic.depth || '表达'}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">这次没有选择知识点，只做复盘文档。</p>
      )}
      {task.selection?.feedback && <p className="quote-meta">补充反馈：{task.selection.feedback}</p>}
    </div>
  );
}

function TaskForm({ task, onSubmitted }) {
  const initialTopics = useMemo(
    () =>
      (task.topics || []).map((topic) => ({
        id: topic.id,
        title: topic.title,
        selected: topic.selected !== false,
        depth: DEPTHS.some((item) => item.value === topic.depth) ? topic.depth : '表达',
      })),
    [task],
  );
  const [topics, setTopics] = useState(initialTopics);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const selectedCount = topics.filter((topic) => topic.selected).length;

  function updateTopic(id, patch) {
    setTopics((current) => current.map((topic) => (topic.id === id ? { ...topic, ...patch } : topic)));
  }

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    setSubmitting(true);
    try {
      const updated = await api(`/api/tasks/${encodeURIComponent(task.id)}/selection`, {
        method: 'POST',
        body: JSON.stringify({ topics, feedback }),
      });
      onSubmitted(updated);
    } catch (err) {
      setMessage(`提交失败：${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="current-task" onSubmit={submit}>
      <div className="topic-grid">
        {(task.topics || []).map((topic) => {
          const draft = topics.find((item) => item.id === topic.id) || {};
          return (
            <article className={`topic-card ${draft.selected ? 'topic-card-selected' : ''}`} key={topic.id}>
              <label className="topic-check">
                <input
                  type="checkbox"
                  checked={!!draft.selected}
                  onChange={(event) => updateTopic(topic.id, { selected: event.target.checked })}
                />
                <span>{topic.title}</span>
              </label>
              <p>{topic.plain_explanation || '这个知识点需要你确认是否要学。'}</p>
              <p className="muted">{topic.why_relevant || '它和本次复盘有关。'}</p>
              <div className="topic-card-actions">
                <div className="recommend">推荐：{topic.recommended_depth || '表达'}</div>
                <div className="segmented" aria-label={`${topic.title} 学习深度`}>
                  {DEPTHS.map((depth) => (
                    <button
                      type="button"
                      key={depth.value}
                      className={draft.depth === depth.value ? 'selected' : ''}
                      disabled={!draft.selected}
                      title={depth.hint}
                      onClick={() => updateTopic(topic.id, { depth: depth.value })}
                    >
                      {depth.value}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <label className="feedback-label">
        <span>补充反馈</span>
        <textarea
          rows="3"
          value={feedback}
          placeholder="例如：React 从零讲，不要假设我懂；API 限流我想学到能自己判断方案。"
          onChange={(event) => setFeedback(event.target.value)}
        />
      </label>
      {message && <div className="inline-error">{message}</div>}
      <div className="form-footer">
        <span className="muted">已选择 {selectedCount} 个知识点</span>
        <button className="button button-primary" disabled={submitting} type="submit">
          {submitting ? '提交中' : '提交学习选择'}
        </button>
      </div>
    </form>
  );
}

function LedgerSection() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [project, setProject] = useState('');
  const [domain, setDomain] = useState('');
  const [minConfidence, setMinConfidence] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [expandedLine, setExpandedLine] = useState(null);

  useEffect(() => {
    api('/api/learnings').then(setData).catch((err) => setError(err.message));
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const keyword = query.trim().toLowerCase();
    return (data.learnings || []).filter((row) => {
      if (!showAll && row.effective_status !== 'active') return false;
      if (project && row.project !== project) return false;
      if (domain && row.domain !== domain) return false;
      if ((row.confidence || 0) < minConfidence) return false;
      if (keyword && !`${row.key} ${row.insight}`.toLowerCase().includes(keyword)) return false;
      return true;
    });
  }, [data, query, project, domain, minConfidence, showAll]);

  if (error) return <div className="inline-error">账本读取失败：{error}</div>;
  if (!data) return <EmptyState text="正在读取账本。" />;

  const counts = data.counts || {};

  return (
    <section className="panel ledger-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">learnings.jsonl · 复利资产</p>
          <h1>教训账本</h1>
        </div>
        <span className="mono">
          {countLabel(counts.active || 0, '条活跃')} / {countLabel(counts.total || 0, '条总计')}
        </span>
      </div>
      <div className="ledger-filters">
        <input
          className="ledger-search"
          type="search"
          placeholder="🔍 搜索键名或洞察…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select value={project} onChange={(event) => setProject(event.target.value)}>
          <option value="">全部项目</option>
          {(counts.projects || []).map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select value={domain} onChange={(event) => setDomain(event.target.value)}>
          <option value="">全部能力域</option>
          {(counts.domains || []).map((name) => (
            <option key={name} value={name}>{DOMAIN_LABELS[name] || name}</option>
          ))}
        </select>
        <select value={minConfidence} onChange={(event) => setMinConfidence(Number(event.target.value))}>
          <option value={0}>置信度不限</option>
          <option value={7}>≥ 7</option>
          <option value={8}>≥ 8</option>
          <option value={9}>≥ 9</option>
        </select>
        <label className="ledger-showall">
          <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
          <span>含已取代</span>
        </label>
      </div>
      {rows.length ? (
        <div className="ledger-list">
          {rows.map((row) => {
            const expanded = expandedLine === row._line;
            return (
              <article
                className={`ledger-row ${expanded ? 'ledger-row-expanded' : ''} ${row.effective_status !== 'active' ? 'ledger-row-stale' : ''}`}
                key={row._line}
                onClick={() => setExpandedLine(expanded ? null : row._line)}
              >
                <div className="ledger-row-main">
                  <span className={`confidence-badge confidence-${row.confidence >= 9 ? 'high' : row.confidence >= 7 ? 'mid' : 'low'}`}>
                    {row.confidence || '?'}
                  </span>
                  <strong className="ledger-key">{row.key}</strong>
                  <span className={`domain-tag domain-${row.domain || 'unknown'}`}>{DOMAIN_LABELS[row.domain] || row.domain}</span>
                  <span className="mono ledger-project">{row.project}</span>
                </div>
                <p className={`ledger-insight ${expanded ? '' : 'ledger-insight-clamp'}`}>{row.insight}</p>
                {expanded && (
                  <div className="ledger-meta">
                    <span>来源：{row.evidence || '—'}</span>
                    <span>记录于 {formatDate(row.ts)}</span>
                    <span>状态：{row.effective_status === 'active' ? '✅ 活跃' : `⏸ ${row.effective_status}`}</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState text={counts.total ? '没有匹配的条目，试试放宽筛选。' : '账本还是空的——做一次 /forge-fupan 复盘就有了。'} />
      )}
    </section>
  );
}

function ReviewsSection() {
  const [reviews, setReviews] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/reviews').then((data) => setReviews(data.reviews || [])).catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="inline-error">加载失败：{error}</div>;
  if (!reviews) return <EmptyState text="正在读取复盘列表。" />;

  return (
    <section className="panel history-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">历史记录</p>
          <h2>历史复盘</h2>
        </div>
        <span className="mono">{countLabel(reviews.length, '篇复盘')}</span>
      </div>
      {reviews.length ? (
        <div className="history-table">
          <div className="history-head">
            <span>日期</span>
            <span>标题</span>
            <span>项目</span>
            <span>学到的知识</span>
          </div>
          {reviews.map((review) => (
            <a className="history-row" href={`/review/${encodeURIComponent(review.id)}`} key={review.id}>
              <span className="mono">{formatDate(review.created_at)}</span>
              <strong>{review.title}</strong>
              <span>{review.project}</span>
              <span className="topic-tags">{(review.learned_topics || []).slice(0, 5).map((topic) => <em key={topic}>{topic}</em>)}</span>
            </a>
          ))}
        </div>
      ) : (
        <EmptyState text="还没有复盘记录。" />
      )}
    </section>
  );
}

function ReviewDetail({ reviewId }) {
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');
  const [zoomImage, setZoomImage] = useState(null);

  useEffect(() => {
    api(`/api/reviews/${encodeURIComponent(reviewId)}`)
      .then(setReview)
      .catch((err) => setError(err.message));
  }, [reviewId]);

  if (error) {
    return (
      <main className="detail-shell">
        <a className="back-link" href="/">返回工作台</a>
        <div className="inline-error">复盘读取失败：{error}</div>
      </main>
    );
  }
  if (!review) {
    return (
      <main className="detail-shell">
        <a className="back-link" href="/">返回工作台</a>
        <EmptyState text="正在读取复盘。" />
      </main>
    );
  }

  const stripped = stripDuplicateTitle(review.content || '', review.title);
  const visibleHeadings = stripped.stripped ? (review.headings || []).slice(1) : review.headings || [];
  const headingItems = buildHeadingItems(visibleHeadings);
  const tocItems = headingItems.filter((heading) => heading.level >= 2 && heading.level <= 3);
  const html = renderMarkdown(stripped.content, headingItems);

  function handleMarkdownClick(event) {
    const button = event.target.closest('button[data-zoom-src]');
    if (!button || !event.currentTarget.contains(button)) return;
    setZoomImage({
      src: button.dataset.zoomSrc,
      alt: button.dataset.zoomAlt || '复盘图片',
    });
  }

  return (
    <main className="detail-shell">
      <header className="detail-top">
        <a className="back-link" href="/">返回工作台</a>
        <span className="mono">{review.project} / {formatDate(review.created_at)}</span>
      </header>
      <div className="detail-layout">
        <aside className="detail-sidebar">
          <section className="sidebar-section">
            <p className="eyebrow">快速定位</p>
            <h2>本篇目录</h2>
            <ReviewToc items={tocItems} />
          </section>
          <section className="sidebar-section">
            <p className="eyebrow">知识地图</p>
            <h2>学到的知识</h2>
            <KnowledgeMap topics={review.learned_topics || []} />
          </section>
          <details className="source-details">
            <summary>源文件</summary>
            <p className="file-path">{review.path}</p>
          </details>
        </aside>
        <article className="review-content">
          <h1>{review.title}</h1>
          {review.summary && <p className="review-summary">{review.summary}</p>}
          <div className="markdown-body" onClick={handleMarkdownClick} dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      </div>
      {zoomImage && <ImageLightbox image={zoomImage} onClose={() => setZoomImage(null)} />}
    </main>
  );
}

function KnowledgeMap({ topics }) {
  if (!topics.length) {
    return <p className="toc-empty">这篇复盘没有提取知识标签。</p>;
  }
  return (
    <div className="knowledge-map" aria-label={`学到的知识，${topics.length} 个`}>
      <div className="knowledge-map-summary">
        <span>学习路线</span>
        <strong>{topics.length} 个</strong>
      </div>
      <ol className="knowledge-list">
        {topics.map((topic, index) => (
          <li key={`${topic}-${index}`}>
            <span className="knowledge-index">{index + 1}</span>
            <span className="knowledge-label">{topic}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ImageLightbox({ image, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="放大图片" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <button className="image-lightbox-close" type="button" onClick={onClose}>
        关闭
      </button>
      <figure>
        <img src={image.src} alt={image.alt} />
        {image.alt && <figcaption>{image.alt}</figcaption>}
      </figure>
    </div>
  );
}

function ReviewToc({ items }) {
  if (!items.length) {
    return <p className="toc-empty">这篇复盘没有可用目录。</p>;
  }
  return (
    <nav className="toc-list" aria-label="本篇目录">
      {items.map((item) => (
        <a className={`toc-link toc-level-${item.level}`} href={`#${encodeURIComponent(item.id)}`} key={`${item.id}-${item.title}`}>
          {item.title}
        </a>
      ))}
    </nav>
  );
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}

createRoot(document.getElementById('root')).render(<App />);
