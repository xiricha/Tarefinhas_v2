const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, '0');
}

function toDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function normalizeDate(input) {
  if (!input) return null;
  if (input instanceof Date) return toDateKey(input);
  return input.slice(0, 10);
}

function parseQuickAdd(input, now = new Date()) {
  const original = input.trim();
  const tokens = [];
  const labels = [];
  const contexts = [];
  const assignees = [];
  let title = original;
  let project = null;
  let priority = 4;
  let dueDate = null;
  let dueTime = null;
  let reminder = null;
  let recurrenceRule = null;
  let recurrenceMode = 'schedule';

  const consume = (regex, type, handler) => {
    title = title.replace(regex, (match, ...args) => {
      const clean = match.trim();
      const value = handler(clean, args);
      tokens.push({ type, raw: clean, value });
      return ' ';
    });
  };

  consume(/#[\p{L}\p{N}_-]+/giu, 'label', raw => {
    const label = raw.slice(1);
    labels.push(label);
    return label;
  });
  consume(/(^|\s)@[\p{L}\p{N}_-]+/giu, 'context', raw => {
    const context = raw.trim().slice(1);
    contexts.push(context);
    labels.push(context);
    return context;
  });
  consume(/\/[\p{L}\p{N}_-]+/giu, 'project', raw => {
    project = raw.slice(1);
    return project;
  });
  consume(/\+[\p{L}\p{N}_-]+/giu, 'assignee', raw => {
    const assignee = raw.slice(1);
    assignees.push(assignee);
    return assignee;
  });
  consume(/\bp([1-4])\b/giu, 'priority', raw => {
    priority = Number(raw.slice(1));
    return priority;
  });
  consume(/!(\d{1,2}:\d{2})\b/giu, 'reminder', raw => {
    reminder = raw.slice(1);
    return reminder;
  });
  consume(/\b(hoje|today)\b/giu, 'date', raw => {
    dueDate = toDateKey(now);
    return dueDate;
  });
  consume(/(?:^|\s)(amanh[ãa]|tomorrow)(?=\s|$)/giu, 'date', raw => {
    dueDate = toDateKey(addDays(now, 1));
    return dueDate;
  });
  consume(/\b(?:em\s*)?(\d{1,2})\s*dias?\b/giu, 'date', (raw, args) => {
    const amount = Number(args[0]);
    dueDate = toDateKey(addDays(now, amount));
    return dueDate;
  });
  consume(/\b(\d{1,2})(?:[/:h](\d{2})|h)\b/giu, 'time', (raw, args) => {
    dueTime = `${pad(args[0])}:${args[1] || '00'}`;
    return dueTime;
  });
  consume(/\b(todo dia útil|todos os dias úteis|every weekday)\b/giu, 'recurrence', raw => {
    recurrenceRule = 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    return 'todo dia útil';
  });
  consume(/\b(toda|todo)\s+(segunda|terça|ter[cç]a|quarta|quinta|sexta|sábado|sabado|domingo)\b/giu, 'recurrence', raw => {
    const map = { segunda: 'MO', terça: 'TU', terca: 'TU', 'terca': 'TU', quarta: 'WE', quinta: 'TH', sexta: 'FR', sábado: 'SA', sabado: 'SA', domingo: 'SU' };
    const day = Object.keys(map).find(key => raw.toLowerCase().includes(key));
    recurrenceRule = `FREQ=WEEKLY;BYDAY=${map[day] || 'MO'}`;
    return raw.toLowerCase();
  });
  consume(/\ba cada\s+(\d+)\s+(dias?|semanas?|meses?)\b/giu, 'recurrence', (raw, args) => {
    const interval = Number(args[0]);
    const unit = args[1].startsWith('sem') ? 'WEEKLY' : args[1].startsWith('mes') ? 'MONTHLY' : 'DAILY';
    recurrenceRule = `FREQ=${unit};INTERVAL=${interval}`;
    recurrenceMode = 'after_completion';
    return raw.toLowerCase();
  });

  title = title.replace(/\s+/g, ' ').trim();
  return {
    title: title || original,
    labels,
    contexts,
    project,
    assignees,
    priority,
    dueDate,
    dueTime,
    reminder,
    recurrenceRule,
    recurrenceMode,
    tokens,
  };
}

function isInboxTask(task) {
  return !task.projectId && task.status === 'active';
}

function isTodayTask(task, now = new Date()) {
  return task.status === 'active' && normalizeDate(task.dueDate) === toDateKey(now);
}

function isOverdueTask(task, now = new Date()) {
  const due = normalizeDate(task.dueDate);
  return task.status === 'active' && Boolean(due) && due < toDateKey(now);
}

function groupUpcoming(tasks, now = new Date(), days = 14) {
  const today = toDateKey(now);
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = toDateKey(addDays(now, index + 1));
    return { date, load: 0, overload: false, tasks: [] };
  });
  const byDate = Object.fromEntries(buckets.map(bucket => [bucket.date, bucket]));
  tasks.forEach(task => {
    const due = normalizeDate(task.dueDate);
    if (task.status === 'active' && due && due > today && byDate[due]) {
      byDate[due].tasks.push(task);
    }
  });
  buckets.forEach(bucket => {
    bucket.load = bucket.tasks.reduce((sum, task) => sum + (task.durationEstimate || 30), 0);
    bucket.overload = bucket.load > 240 || bucket.tasks.length > 5;
  });
  return buckets;
}

function generateRecurringInstance(task, completedAt = new Date()) {
  if (!task.recurrenceRule) return null;
  const date = task.recurrenceMode === 'after_completion' ? new Date(completedAt) : new Date(task.dueDate || completedAt);
  const intervalMatch = task.recurrenceRule.match(/INTERVAL=(\d+)/);
  const interval = intervalMatch ? Number(intervalMatch[1]) : 1;
  if (task.recurrenceRule.includes('FREQ=DAILY')) date.setDate(date.getDate() + interval);
  else if (task.recurrenceRule.includes('FREQ=WEEKLY')) date.setDate(date.getDate() + 7 * interval);
  else if (task.recurrenceRule.includes('FREQ=MONTHLY')) date.setMonth(date.getMonth() + interval);
  else if (task.recurrenceRule.includes('FREQ=YEARLY')) date.setFullYear(date.getFullYear() + interval);
  return { ...task, id: `${task.id}-next-${toDateKey(date)}`, status: 'active', dueDate: toDateKey(date), completedAt: null };
}

function buildFilterQuery(conditions, operator = 'AND') {
  const pieces = conditions.map(condition => `${condition.field}:${condition.comparator}:${condition.value}`);
  return pieces.join(` ${operator} `);
}

function humanizeFilter(conditions, operator = 'AND') {
  if (!conditions.length) return 'Mostrar todas as tarefas ativas.';
  const text = conditions.map(c => `${c.field} ${c.comparator} ${c.value}`).join(operator === 'OR' ? ' ou ' : ' e ');
  return `Mostrar tarefas em que ${text}.`;
}

function deriveInboxSuggestions(task, projects = [], labels = []) {
  const text = task.title.toLowerCase();
  const project = projects.find(p => text.includes(p.name.toLowerCase())) || projects.find(p => /reuni|cliente|email|relat/.test(text) && p.name === 'Trabalho');
  const label = labels.find(l => text.includes(l.name.toLowerCase())) || labels.find(l => /rua|mercado|comprar/.test(text) && l.name === 'rua');
  const tooLarge = /planejar|organizar|projeto|lançar|criar/.test(text) && text.split(' ').length > 3;
  const hasClearVerb = /^(pagar|enviar|ligar|comprar|revisar|agendar|responder|preparar|fazer|criar)\b/.test(text);
  return { project: project?.name || null, label: label?.name || null, priority: /urgente|hoje|cliente/.test(text) ? 1 : 3, tooLarge, needsClearVerb: !hasClearVerb };
}

function generateInsights(tasks, settings = { visible: true }) {
  if (!settings.visible) return [];
  const active = tasks.filter(t => t.status === 'active');
  const completed = tasks.filter(t => t.status === 'completed');
  const postponed = tasks.filter(t => (t.rescheduleCount || 0) >= 2);
  const undated = active.filter(t => !t.dueDate);
  const recurringCompleted = completed.filter(t => t.recurrenceRule);
  const insights = [];
  if (undated.length) insights.push({ tone: 'calm', title: 'Backlog sem data', body: `${undated.length} tarefas ainda estão sem data. Que tal triar 5 agora?`, action: 'Abrir filtro Sem data' });
  if (postponed.length) insights.push({ tone: 'warning', title: 'Atrasos repetidos', body: `${postponed[0].title} foi adiada várias vezes. Talvez precise virar subtarefas.`, action: 'Revisar tarefa' });
  if (recurringCompleted.length) insights.push({ tone: 'success', title: 'Rotina mantida', body: `Você manteve ${recurringCompleted.length} recorrências concluídas recentemente.`, action: 'Ver recorrentes' });
  if (completed.length) insights.push({ tone: 'neutral', title: 'Ritmo da semana', body: `Você concluiu ${completed.length} tarefas. Continue com uma lista curta e clara.`, action: 'Ver Today' });
  return insights.slice(0, 5);
}

module.exports = { parseQuickAdd, groupUpcoming, generateRecurringInstance, buildFilterQuery, humanizeFilter, deriveInboxSuggestions, generateInsights, isInboxTask, isTodayTask, isOverdueTask, toDateKey, addDays };
