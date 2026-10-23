(function () {
  'use strict';

  const FOCUS_MS = 25 * 60 * 1000;
  const BREAK_MS = 5 * 60 * 1000;

  function duration(phase) {
    return phase === 'focus' ? FOCUS_MS : BREAK_MS;
  }

  function phaseLabel(phase) {
    return phase === 'focus' ? '专注' : '休息';
  }

  function dateKey(ms) {
    const date = new Date(ms);
    return [
      String(date.getFullYear()).padStart(4, '0'),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  function initial(now) {
    return {
      date: dateKey(now), count: 0, countedEndAt: null,
      phase: 'focus', status: 'idle', endAt: null, remainingMs: null, alert: null,
    };
  }

  function remainingMs(state, now) {
    const full = duration(state.phase);
    let remaining = full;
    if (state.status === 'running') remaining = state.endAt - now;
    if (state.status === 'paused') remaining = state.remainingMs;
    return Math.min(full, Math.max(0, remaining));
  }

  function formatTime(ms) {
    const seconds = Math.ceil(Math.max(0, ms) / 1000);
