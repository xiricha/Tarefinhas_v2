const assert = require('assert');
const { parseQuickAdd, groupUpcoming, generateRecurringInstance, buildFilterQuery, humanizeFilter, deriveInboxSuggestions, generateInsights, isInboxTask, isTodayTask } = require('../src/core/productivity');

const now = new Date('2026-06-10T09:00:00Z');
const parsed = parseQuickAdd('Pagar condomínio amanhã 9h #Financeiro @casa p1 /Admin +Joao !14:00', now);
assert.equal(parsed.title, 'Pagar condomínio');
assert.equal(parsed.dueDate, '2026-06-11');
assert.equal(parsed.dueTime, '09:00');
assert.equal(parsed.priority, 1);
assert.equal(parsed.project, 'Admin');
assert.deepEqual(parsed.labels, ['Financeiro', 'casa']);
assert.deepEqual(parsed.assignees, ['Joao']);
assert.equal(parsed.reminder, '14:00');

assert.equal(isInboxTask({ status: 'active', projectId: null }), true);
assert.equal(isTodayTask({ status: 'active', dueDate: '2026-06-10' }, now), true);

const upcoming = groupUpcoming([{ id: 'a', status: 'active', dueDate: '2026-06-11', durationEstimate: 300 }], now, 2);
assert.equal(upcoming[0].tasks.length, 1);
assert.equal(upcoming[0].overload, true);

const next = generateRecurringInstance({ id: 'r1', status: 'completed', dueDate: '2026-06-10', recurrenceRule: 'FREQ=WEEKLY;INTERVAL=2', recurrenceMode: 'schedule' }, now);
assert.equal(next.dueDate, '2026-06-24');

const conditions = [{ field: 'Data', comparator: 'é', value: 'hoje' }];
assert.equal(buildFilterQuery(conditions), 'Data:é:hoje');
assert.equal(humanizeFilter(conditions), 'Mostrar tarefas em que Data é hoje.');

const suggestion = deriveInboxSuggestions({ title: 'Comprar lâmpadas na rua' }, [{ name: 'Casa' }], [{ name: 'rua' }]);
assert.equal(suggestion.label, 'rua');
assert.equal(suggestion.needsClearVerb, false);

const insights = generateInsights([{ title: 'X', status: 'active' }, { title: 'Y', status: 'active', rescheduleCount: 2 }]);
assert.ok(insights.length <= 5);
assert.ok(insights.some(i => i.title === 'Backlog sem data'));
console.log('productivity domain tests passed');
