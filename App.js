import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal, Switch, Pressable } from 'react-native';
import { parseQuickAdd, groupUpcoming, generateRecurringInstance, buildFilterQuery, humanizeFilter, deriveInboxSuggestions, generateInsights, isInboxTask, isTodayTask, isOverdueTask, toDateKey, addDays } from './src/core/productivity';

const today = new Date('2026-06-10T09:00:00Z');
const seedProjects = [
  { id: 'p1', name: 'Trabalho', color: '#2563eb', icon: '💼', count: 4, favorite: true },
  { id: 'p2', name: 'Casa', color: '#16a34a', icon: '🏡', count: 3, favorite: true },
  { id: 'p3', name: 'Admin', color: '#f97316', icon: '🧾', count: 2, favorite: false },
];
const seedLabels = [
  { id: 'l1', name: 'rua', color: '#8b5cf6' },
  { id: 'l2', name: '15min', color: '#0ea5e9' },
  { id: 'l3', name: 'aguardando', color: '#64748b' },
];
const initialTasks = [
  { id: 't1', title: 'Enviar proposta para cliente', status: 'active', priority: 1, dueDate: '2026-06-10', dueTime: '10:30', projectId: 'p1', labels: ['aguardando'], durationEstimate: 45, commentsCount: 2, attachmentsCount: 1, rescheduleCount: 0 },
  { id: 't2', title: 'Pagar condomínio', status: 'active', priority: 1, dueDate: '2026-06-11', dueTime: '09:00', projectId: null, labels: ['rua'], durationEstimate: 15, commentsCount: 0, attachmentsCount: 0, rescheduleCount: 1 },
  { id: 't3', title: 'Revisão semanal', status: 'active', priority: 2, dueDate: '2026-06-10', recurrenceRule: 'FREQ=WEEKLY;BYDAY=FR', recurrenceMode: 'schedule', projectId: 'p3', labels: ['15min'], durationEstimate: 30, commentsCount: 1, attachmentsCount: 0, rescheduleCount: 0 },
  { id: 't4', title: 'Organizar documentos do imposto', status: 'active', priority: 3, dueDate: null, projectId: null, labels: [], durationEstimate: 60, commentsCount: 0, attachmentsCount: 2, rescheduleCount: 3 },
  { id: 't5', title: 'Comprar presente de aniversário', status: 'active', priority: 3, dueDate: '2026-06-14', projectId: 'p2', labels: ['rua'], durationEstimate: 45, commentsCount: 0, attachmentsCount: 0, rescheduleCount: 0 },
  { id: 't6', title: 'Responder orçamento da reforma', status: 'active', priority: 2, dueDate: '2026-06-09', projectId: 'p2', labels: [], durationEstimate: 20, commentsCount: 0, attachmentsCount: 0, rescheduleCount: 2 },
  { id: 't7', title: 'Meditar 10 minutos', status: 'completed', priority: 4, dueDate: '2026-06-10', recurrenceRule: 'FREQ=DAILY', recurrenceMode: 'after_completion', projectId: null, labels: [], durationEstimate: 10, completedAt: '2026-06-10T08:00:00Z' },
];

function TaskCheckbox({ checked, priority, onPress }) {
  return <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={[styles.checkbox, checked && styles.checkboxDone, priority === 1 && styles.checkboxHot]}><Text style={styles.checkText}>{checked ? '✓' : ''}</Text></TouchableOpacity>;
}
function PriorityBadge({ priority }) {
  const copy = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4' }[priority] || 'P4';
  return <Text style={[styles.badge, priority === 1 && styles.badgeHot]}>{copy}</Text>;
}
function DateChip({ date, time }) {
  if (!date) return null;
  return <Text style={styles.chip}>{date.slice(5)}{time ? ` · ${time}` : ''}</Text>;
}
function LabelChip({ label }) {
  return <Text style={styles.chip}>@{label}</Text>;
}
function TaskRow({ task, projects, onComplete, onOpen }) {
  const project = projects.find(p => p.id === task.projectId);
  return <SwipeActionContainer><TouchableOpacity onPress={() => onOpen(task)} style={styles.taskRow}>
    <TaskCheckbox checked={task.status === 'completed'} priority={task.priority} onPress={() => onComplete(task)} />
    <View style={styles.taskBody}>
      <Text style={[styles.taskTitle, task.status === 'completed' && styles.doneText]}>{task.title}</Text>
      <View style={styles.metaRow}>
        <PriorityBadge priority={task.priority} />
        <DateChip date={task.dueDate} time={task.dueTime} />
        {project ? <Text style={styles.chip}>{project.icon} {project.name}</Text> : <Text style={styles.chip}>Inbox</Text>}
        {(task.labels || []).slice(0, 2).map(label => <LabelChip key={label} label={label} />)}
        {task.attachmentsCount > 0 && <Text style={styles.chip}>📎 {task.attachmentsCount}</Text>}
      </View>
    </View>
  </TouchableOpacity></SwipeActionContainer>;
}
function SwipeActionContainer({ children }) {
  return <View style={styles.swipeWrap}>{children}<View style={styles.swipeHint}><Text>↢ concluir · adiar · mover ↣</Text></View></View>;
}
function SectionHeader({ title, count, action }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionCount}>{count}</Text>{action}</View>;
}
function EmptyState({ title, body, cta, onPress }) {
  return <View style={styles.empty}><Text style={styles.emptyIcon}>✨</Text><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text><TouchableOpacity onPress={onPress} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{cta}</Text></TouchableOpacity></View>;
}
function ProjectCard({ project }) {
  return <View style={styles.projectCard}><Text style={styles.projectIcon}>{project.icon}</Text><View><Text style={styles.projectName}>{project.name}</Text><Text style={styles.muted}>{project.count} tarefas · lista, board, calendário</Text></View><Text style={[styles.projectDot, { color: project.color }]}>●</Text></View>;
}
function CalendarStrip({ buckets, selected, onSelect }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.calendarStrip}>{buckets.map(bucket => <TouchableOpacity key={bucket.date} onPress={() => onSelect(bucket.date)} style={[styles.dayPill, selected === bucket.date && styles.dayPillActive]}><Text style={styles.dayName}>{new Date(bucket.date).toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' })}</Text><Text style={styles.dayNumber}>{bucket.date.slice(8)}</Text>{bucket.tasks.length > 0 && <Text style={bucket.overload ? styles.overloadDot : styles.loadDot}>●</Text>}</TouchableOpacity>)}</ScrollView>;
}
function ProductivityCard({ insight }) {
  return <TouchableOpacity style={styles.insightCard}><Text style={styles.insightTone}>{insight.tone === 'success' ? '🌱' : insight.tone === 'warning' ? '⚠️' : '◦'}</Text><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{insight.title}</Text><Text style={styles.cardBody}>{insight.body}</Text><Text style={styles.linkText}>{insight.action}</Text></View></TouchableOpacity>;
}
function AttachmentPicker({ onAttach }) { return <TouchableOpacity onPress={onAttach} style={styles.toolButton}><Text>📎 Anexar</Text></TouchableOpacity>; }
function ReminderPicker() { return <View style={styles.panel}><Text style={styles.cardTitle}>Lembretes</Text><Text style={styles.muted}>Horário, relativo ou localização · ações: concluir, adiar 1h, amanhã, próxima semana.</Text></View>; }
function RecurrenceBuilder() { return <View style={styles.panel}><Text style={styles.cardTitle}>Recorrência</Text><Text style={styles.muted}>Diária, semanal, mensal, anual, “todo dia útil”, “a cada 2 semanas” e “última sexta do mês”. Modos: por agenda ou após conclusão.</Text></View>; }
function CommentComposer() { return <View style={styles.commentBox}><TextInput placeholder="Adicionar comentário para colaboradores…" style={styles.commentInput} /><Text style={styles.send}>Enviar</Text></View>; }

function QuickAddComposer({ visible, onClose, onCreate }) {
  const [value, setValue] = useState('');
  const [attachment, setAttachment] = useState(false);
  const parsed = useMemo(() => parseQuickAdd(value, today), [value]);
  const create = () => {
    if (!parsed.title.trim()) return;
    onCreate(parsed, attachment);
    setValue(''); setAttachment(false); onClose();
  };
  return <Modal animationType="slide" visible={visible} transparent onRequestClose={onClose}><View style={styles.modalShade}><View style={styles.quickAdd}>
    <Text style={styles.modalTitle}>Quick Add</Text>
    <TextInput autoFocus multiline value={value} onChangeText={setValue} placeholder="Ex.: Pagar condomínio amanhã 9h #Financeiro @casa p1" style={styles.quickInput} />
    <View style={styles.tokenRow}>{parsed.tokens.map((token, index) => <Text key={`${token.raw}-${index}`} style={styles.token}>{token.raw}</Text>)}{attachment && <Text style={styles.token}>📎 anexo</Text>}</View>
    {parsed.recurrenceRule && <Text style={styles.preview}>Próxima ocorrência prevista a partir da regra: {parsed.recurrenceRule}</Text>}
    {!parsed.title && value.length > 0 && <Text style={styles.error}>Não consegui identificar um título executável.</Text>}
    <View style={styles.modalActions}><AttachmentPicker onAttach={() => setAttachment(true)} /><TouchableOpacity onPress={onClose} style={styles.toolButton}><Text>Cancelar</Text></TouchableOpacity><TouchableOpacity onPress={create} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Salvar</Text></TouchableOpacity></View>
  </View></View></Modal>;
}
function InlineFilterBuilder({ onSave }) {
  const [conditions, setConditions] = useState([{ field: 'Data', comparator: 'é', value: 'hoje' }, { field: 'Prioridade', comparator: 'é', value: 'alta' }]);
  const [operator, setOperator] = useState('AND');
  const query = buildFilterQuery(conditions, operator);
  const preview = humanizeFilter(conditions, operator);
  return <View style={styles.panel}><Text style={styles.cardTitle}>Construtor visual</Text>
    <View style={styles.tokenRow}>{conditions.map((c, i) => <Text key={i} style={styles.filterBlock}>{c.field} {c.comparator} {c.value}</Text>)}<TouchableOpacity onPress={() => setOperator(operator === 'AND' ? 'OR' : 'AND')}><Text style={styles.operator}>{operator}</Text></TouchableOpacity></View>
    <Text style={styles.preview}>{preview}</Text><Text style={styles.query}>{query}</Text>
    <TouchableOpacity onPress={() => setConditions([...conditions, { field: 'Status', comparator: 'é', value: 'ativo' }])} style={styles.toolButton}><Text>+ condição</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => onSave({ name: 'Hoje + alta prioridade', query, visualConfig: conditions })} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Salvar e favoritar</Text></TouchableOpacity>
    <Text style={styles.muted}>Limitação MVP: recorrência pode ser filtrada como verdadeiro/falso; frequência específica fica documentada para engine avançada.</Text>
  </View>;
}

export default function App() {
  const [onboarded, setOnboarded] = useState(false);
  const [tab, setTab] = useState('Today');
  const [tasks, setTasks] = useState(initialTasks);
  const [quickOpen, setQuickOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [insightsVisible, setInsightsVisible] = useState(true);
  const [filters, setFilters] = useState([{ id: 'f1', name: 'Sem data', query: 'due:none AND status:active', favorite: true }]);
  const buckets = useMemo(() => groupUpcoming(tasks, today, 14), [tasks]);
  const insights = useMemo(() => generateInsights(tasks, { visible: insightsVisible }), [tasks, insightsVisible]);
  const completeTask = (task) => setTasks(current => {
    const completed = current.map(item => item.id === task.id ? { ...item, status: 'completed', completedAt: today.toISOString() } : item);
    const next = generateRecurringInstance(task, today);
    return next ? [next, ...completed] : completed;
  });
  const createTask = (parsed, attachment) => setTasks(current => [{ id: `t${Date.now()}`, title: parsed.title, status: 'active', priority: parsed.priority, dueDate: parsed.dueDate, dueTime: parsed.dueTime, recurrenceRule: parsed.recurrenceRule, recurrenceMode: parsed.recurrenceMode, projectId: seedProjects.find(p => p.name === parsed.project)?.id || null, labels: parsed.labels, durationEstimate: 30, commentsCount: 0, attachmentsCount: attachment ? 1 : 0, sourceType: 'quick_add' }, ...current]);
  if (!onboarded) return <Onboarding onFinish={() => setOnboarded(true)} />;
  return <SafeAreaView style={styles.app}><View style={styles.shell}><ScrollView contentContainerStyle={styles.content}>{tab === 'Today' && <TodayScreen tasks={tasks} projects={seedProjects} insights={insights} insightsVisible={insightsVisible} setInsightsVisible={setInsightsVisible} onComplete={completeTask} onOpen={setDetail} />}{tab === 'Upcoming' && <UpcomingScreen buckets={buckets} projects={seedProjects} onOpen={setDetail} onComplete={completeTask} />}{tab === 'Inbox' && <InboxScreen tasks={tasks} projects={seedProjects} labels={seedLabels} processing={processing} setProcessing={setProcessing} onComplete={completeTask} onOpen={setDetail} setTasks={setTasks} />}{tab === 'Projects' && <ProjectsScreen projects={seedProjects} tasks={tasks} onOpen={setDetail} onComplete={completeTask} />}{tab === 'More' && <MoreScreen filters={filters} setFilters={setFilters} labels={seedLabels} insights={insights} setInsightsVisible={setInsightsVisible} />}</ScrollView><BottomNav tab={tab} setTab={setTab} /><TouchableOpacity accessibilityLabel="Adicionar tarefa" onPress={() => setQuickOpen(true)} style={styles.fab}><Text style={styles.fabText}>＋</Text></TouchableOpacity></View><QuickAddComposer visible={quickOpen} onClose={() => setQuickOpen(false)} onCreate={createTask} /><TaskDetail task={detail} projects={seedProjects} onClose={() => setDetail(null)} /></SafeAreaView>;
}
function Onboarding({ onFinish }) {
  const [step, setStep] = useState(0); const focus = ['pessoal', 'trabalho', 'estudos', 'família'];
  const screens = [
    ['Capture rápido', 'Organize sem esforço e execute com clareza todos os dias.'],
    ['Qual é seu foco?', `Vamos sugerir projetos e labels para ${focus.join(', ')}.`],
    ['Modo de uso', 'Simples para começar leve, avançado para filtros, recorrências e colaboração.'],
    ['Notificações acionáveis', 'Conclua, adie ou abra tarefas direto do lembrete.'],
    ['Projetos sugeridos', 'Trabalho, Casa, Admin e Someday/Maybe já prontos para adaptar.'],
    ['Importar ou pular', 'Traga tarefas de outro app quando quiser.'],
  ];
  return <SafeAreaView style={styles.onboarding}><View style={styles.heroCard}><Text style={styles.logo}>Tarefinhas</Text><Text style={styles.heroTitle}>{screens[step][0]}</Text><Text style={styles.heroBody}>{screens[step][1]}</Text><View style={styles.dots}>{screens.map((_, i) => <Text key={i} style={i === step ? styles.dotActive : styles.dot}>●</Text>)}</View><TouchableOpacity onPress={() => step === screens.length - 1 ? onFinish() : setStep(step + 1)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{step === screens.length - 1 ? 'Começar' : 'Continuar'}</Text></TouchableOpacity></View></SafeAreaView>;
}
function TodayScreen({ tasks, projects, insights, insightsVisible, setInsightsVisible, onComplete, onOpen }) {
  const overdue = tasks.filter(t => isOverdueTask(t, today)); const day = tasks.filter(t => isTodayTask(t, today)); const timed = day.filter(t => t.dueTime); const noTime = day.filter(t => !t.dueTime); const progress = day.length ? Math.round(day.filter(t => t.status === 'completed').length / day.length * 100) : 0;
  return <><Header title="Today" subtitle="Top 3, agenda e execução clara" count={`${progress}%`} /><View style={styles.progress}><View style={[styles.progressFill, { width: `${Math.max(progress, 12)}%` }]} /></View><Suggestion text="Faça primeiro: tarefas P1 com horário antes do almoço." /><Section title="Overdue" list={overdue} projects={projects} onComplete={onComplete} onOpen={onOpen} /><Section title="Com horário" list={timed} projects={projects} onComplete={onComplete} onOpen={onOpen} /><Section title="Sem horário" list={noTime} projects={projects} onComplete={onComplete} onOpen={onOpen} /><View style={styles.rowBetween}><Text style={styles.sectionTitle}>Insights leves</Text><Switch value={insightsVisible} onValueChange={setInsightsVisible} /></View>{insights.map((insight, i) => <ProductivityCard key={i} insight={insight} />)}</>;
}
function UpcomingScreen({ buckets, projects, onOpen, onComplete }) {
  const [selected, setSelected] = useState(buckets[0]?.date); return <><Header title="Upcoming" subtitle="Junho 2026 · 7/14 dias/mês" count="14d" /><CalendarStrip buckets={buckets} selected={selected} onSelect={setSelected} />{buckets.map(bucket => <View key={bucket.date} style={styles.dayBlock}><SectionHeader title={new Date(bucket.date).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short', timeZone: 'UTC' })} count={`${bucket.tasks.length} · ${Math.round(bucket.load / 60)}h`} action={bucket.overload ? <Text style={styles.overloadText}>sobrecarga</Text> : null} />{bucket.tasks.length ? bucket.tasks.map(task => <TaskRow key={task.id} task={task} projects={projects} onComplete={onComplete} onOpen={onOpen} />) : <Text style={styles.muted}>Dia livre — toque no ＋ para planejar aqui.</Text>}</View>)}</>;
}
function InboxScreen({ tasks, projects, labels, processing, setProcessing, onComplete, onOpen, setTasks }) {
  const inbox = tasks.filter(isInboxTask); const current = inbox[0]; const suggestions = current ? deriveInboxSuggestions(current, projects, labels) : null;
  if (processing) return <><Header title="Processar Inbox" subtitle="Uma decisão por vez" count={`${inbox.length}`} />{current ? <View style={styles.triageCard}><Text style={styles.cardTitle}>{current.title}</Text><Text style={styles.cardBody}>{suggestions.needsClearVerb ? 'Sugestão: reformule com verbo claro.' : 'Título parece executável.'} {suggestions.tooLarge ? 'Talvez seja grande demais: quebre em subtarefas.' : ''}</Text><View style={styles.tokenRow}>{suggestions.project && <Text style={styles.token}>Projeto: {suggestions.project}</Text>}{suggestions.label && <Text style={styles.token}>@{suggestions.label}</Text>}<Text style={styles.token}>P{suggestions.priority}</Text></View>{['Definir projeto', 'Definir data', 'Converter em rotina', 'Someday/Maybe', 'Pular'].map(action => <TouchableOpacity key={action} onPress={() => setTasks(list => list.map(t => t.id === current.id ? { ...t, projectId: suggestions.project ? projects.find(p => p.name === suggestions.project)?.id : t.projectId, priority: suggestions.priority } : t))} style={styles.actionRow}><Text>{action}</Text><Text>›</Text></TouchableOpacity>)}<TouchableOpacity onPress={() => setTasks(list => list.filter(t => t.id !== current.id))} style={styles.dangerButton}><Text style={styles.dangerText}>Excluir e avançar</Text></TouchableOpacity></View> : <EmptyState title="Inbox zerada" body="Tudo foi processado. Sua mente está limpa." cta="Voltar para Inbox" onPress={() => setProcessing(false)} />}</>;
  return <><Header title="Inbox" subtitle="Captura universal em ordem reversa" count={inbox.length} /><TouchableOpacity onPress={() => setProcessing(true)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Processar Inbox</Text></TouchableOpacity>{inbox.length ? inbox.map(task => <TaskRow key={task.id} task={task} projects={projects} onComplete={onComplete} onOpen={onOpen} />) : <EmptyState title="Nada na Inbox" body="Capture a primeira tarefa e organize depois." cta="Capturar primeira tarefa" onPress={() => {}} />}</>;
}
function ProjectsScreen({ projects, tasks, onOpen, onComplete }) { return <><Header title="Projects" subtitle="Estrutura leve, views poderosas" count={projects.length} />{projects.map(project => <View key={project.id}><ProjectCard project={project} /><Section title="Tarefas" list={tasks.filter(t => t.projectId === project.id && t.status === 'active').slice(0, 3)} projects={projects} onComplete={onComplete} onOpen={onOpen} /></View>)}</>; }
function MoreScreen({ filters, setFilters, labels, insights, setInsightsVisible }) { return <><Header title="Browse" subtitle="Filtros, busca, insights e ajustes" count="More" /><View style={styles.panel}><Text style={styles.cardTitle}>Search global</Text><TextInput placeholder="Buscar título, descrição, comentário, label, projeto, anexos…" style={styles.search} /><Text style={styles.muted}>Histórico, tolerância a erros e resultados agrupados por tipo.</Text></View><InlineFilterBuilder onSave={filter => setFilters([...filters, { id: `f${Date.now()}`, ...filter, favorite: true }])} /><Text style={styles.sectionTitle}>Filtros favoritos</Text>{filters.map(f => <View key={f.id} style={styles.actionRow}><Text>{f.name}</Text><Text style={styles.muted}>{f.query}</Text></View>)}<Text style={styles.sectionTitle}>Labels</Text><View style={styles.tokenRow}>{labels.map(l => <Text key={l.id} style={styles.token}>@{l.name}</Text>)}</View><Text style={styles.sectionTitle}>Productivity Insights</Text>{insights.map((insight, i) => <ProductivityCard key={i} insight={insight} />)}<TouchableOpacity onPress={() => setInsightsVisible(false)} style={styles.toolButton}><Text>Ocultar insights completamente</Text></TouchableOpacity><Settings /></>; }
function Settings() { const items = ['Conta e autenticação', 'Tema claro/escuro/sistema', 'Idioma', 'Notificações', 'Quick Add', 'Anexos', 'Widgets', 'Calendário', 'Importação/exportação', 'Backup e sincronização', 'Acessibilidade', 'Atalhos', 'Gestos']; return <View style={styles.panel}><Text style={styles.cardTitle}>Settings</Text>{items.map(item => <View key={item} style={styles.actionRow}><Text>{item}</Text><Text>›</Text></View>)}</View>; }
function TaskDetail({ task, projects, onClose }) { if (!task) return null; const project = projects.find(p => p.id === task.projectId); return <Modal animationType="slide" visible={Boolean(task)} onRequestClose={onClose}><SafeAreaView style={styles.detail}><ScrollView contentContainerStyle={styles.content}><Header title="Task Detail" subtitle="Edição inline e histórico" count="⌄" /><Text style={styles.detailTitle}>{task.title}</Text><TextInput multiline placeholder="Descrição rica…" style={styles.description} /><View style={styles.panel}><Text style={styles.cardTitle}>Metadados</Text><DateChip date={task.dueDate} time={task.dueTime} /><PriorityBadge priority={task.priority} /><Text style={styles.chip}>{project ? project.name : 'Inbox'}</Text>{(task.labels || []).map(label => <LabelChip key={label} label={label} />)}</View><ReminderPicker /><RecurrenceBuilder /><View style={styles.panel}><Text style={styles.cardTitle}>Subtarefas</Text><Text style={styles.muted}>Toque para expandir/recolher suavemente.</Text></View><View style={styles.panel}><Text style={styles.cardTitle}>Comentários e anexos</Text><CommentComposer /><Text style={styles.muted}>{task.commentsCount || 0} comentários · {task.attachmentsCount || 0} anexos · atividade recente registrada.</Text></View><View style={styles.modalActions}>{['Concluir', 'Duplicar', 'Mover', 'Arquivar', 'Excluir'].map(a => <TouchableOpacity key={a} style={styles.toolButton}><Text>{a}</Text></TouchableOpacity>)}</View><TouchableOpacity onPress={onClose} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Fechar</Text></TouchableOpacity></ScrollView></SafeAreaView></Modal>; }
function Section({ title, list, projects, onComplete, onOpen }) { return <View style={styles.section}><SectionHeader title={title} count={list.length} />{list.map(task => <TaskRow key={task.id} task={task} projects={projects} onComplete={onComplete} onOpen={onOpen} />)}</View>; }
function Suggestion({ text }) { return <View style={styles.suggestion}><Text style={styles.suggestionText}>💡 {text}</Text></View>; }
function Header({ title, subtitle, count }) { return <View style={styles.header}><View><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View><Text style={styles.counter}>{count}</Text></View>; }
function BottomNav({ tab, setTab }) { return <View style={styles.nav}>{['Today', 'Upcoming', 'Inbox', 'Projects', 'More'].map(item => <TouchableOpacity key={item} onPress={() => setTab(item)} style={styles.navItem}><Text style={tab === item ? styles.navActive : styles.navText}>{item}</Text></TouchableOpacity>)}</View>; }

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#f8fafc' }, shell: { flex: 1 }, content: { padding: 20, paddingBottom: 120 }, onboarding: { flex: 1, backgroundColor: '#fff7ed', justifyContent: 'center', padding: 24 }, heroCard: { backgroundColor: '#fff', borderRadius: 32, padding: 28, shadowColor: '#7c2d12', shadowOpacity: 0.12, shadowRadius: 24 }, logo: { color: '#ea580c', fontWeight: '800', marginBottom: 40 }, heroTitle: { fontSize: 38, lineHeight: 42, fontWeight: '800', color: '#111827' }, heroBody: { fontSize: 17, lineHeight: 26, color: '#475569', marginTop: 16 }, dots: { flexDirection: 'row', gap: 6, marginVertical: 28 }, dot: { color: '#fed7aa' }, dotActive: { color: '#ea580c' }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }, title: { fontSize: 34, fontWeight: '800', color: '#0f172a' }, subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 }, counter: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, color: '#334155', overflow: 'hidden' }, progress: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 99, marginBottom: 16 }, progressFill: { height: 8, backgroundColor: '#ea580c', borderRadius: 99 }, suggestion: { backgroundColor: '#fff7ed', borderRadius: 18, padding: 14, marginBottom: 16 }, suggestionText: { color: '#9a3412' }, section: { marginBottom: 18 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 10 }, sectionTitle: { fontSize: 18, fontWeight: '750', color: '#0f172a', marginTop: 8 }, sectionCount: { color: '#94a3b8' }, taskRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 20, marginBottom: 10, minHeight: 64 }, checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, checkboxHot: { borderColor: '#ef4444' }, checkboxDone: { backgroundColor: '#22c55e', borderColor: '#22c55e' }, checkText: { color: '#fff', fontWeight: '800' }, taskBody: { flex: 1 }, taskTitle: { fontSize: 16, color: '#111827', fontWeight: '600' }, doneText: { textDecorationLine: 'line-through', color: '#94a3b8' }, metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }, badge: { backgroundColor: '#f1f5f9', color: '#475569', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden', fontSize: 12 }, badgeHot: { backgroundColor: '#fee2e2', color: '#b91c1c' }, chip: { backgroundColor: '#f8fafc', color: '#475569', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden', fontSize: 12, marginRight: 4, marginTop: 4 }, swipeWrap: { position: 'relative' }, swipeHint: { position: 'absolute', right: 14, bottom: -2, opacity: 0.18 }, projectCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 16, borderRadius: 22, marginVertical: 8 }, projectIcon: { fontSize: 26 }, projectName: { fontSize: 17, fontWeight: '750' }, projectDot: { marginLeft: 'auto', fontSize: 20 }, muted: { color: '#64748b', lineHeight: 20 }, calendarStrip: { marginBottom: 16 }, dayPill: { backgroundColor: '#fff', borderRadius: 20, padding: 12, minWidth: 64, marginRight: 8, alignItems: 'center' }, dayPillActive: { backgroundColor: '#0f172a' }, dayName: { color: '#94a3b8', fontSize: 12 }, dayNumber: { color: '#334155', fontSize: 20, fontWeight: '800' }, loadDot: { color: '#22c55e' }, overloadDot: { color: '#ef4444' }, overloadText: { color: '#b91c1c', fontSize: 12 }, dayBlock: { marginBottom: 18 }, empty: { alignItems: 'center', padding: 32, backgroundColor: '#fff', borderRadius: 28 }, emptyIcon: { fontSize: 36 }, emptyTitle: { fontSize: 22, fontWeight: '800', marginTop: 8 }, emptyBody: { color: '#64748b', textAlign: 'center', marginVertical: 12 }, primaryButton: { backgroundColor: '#ea580c', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', minHeight: 44 }, primaryButtonText: { color: '#fff', fontWeight: '800' }, secondaryButton: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, alignItems: 'center', minHeight: 44 }, secondaryButtonText: { color: '#ea580c', fontWeight: '800' }, fab: { position: 'absolute', right: 20, bottom: 82, width: 62, height: 62, borderRadius: 31, backgroundColor: '#ea580c', alignItems: 'center', justifyContent: 'center', shadowColor: '#9a3412', shadowOpacity: 0.3, shadowRadius: 16 }, fabText: { color: '#fff', fontSize: 34, lineHeight: 36 }, nav: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: '#fff', borderRadius: 28, minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 18 }, navItem: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }, navText: { color: '#64748b', fontSize: 12 }, navActive: { color: '#ea580c', fontWeight: '900', fontSize: 12 }, modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.18)' }, quickAdd: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30 }, modalTitle: { fontSize: 24, fontWeight: '800' }, quickInput: { minHeight: 96, fontSize: 18, lineHeight: 26, paddingVertical: 16 }, tokenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }, token: { backgroundColor: '#fff7ed', color: '#9a3412', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99, overflow: 'hidden' }, preview: { color: '#2563eb', marginVertical: 8, lineHeight: 20 }, error: { color: '#dc2626' }, modalActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', marginTop: 10 }, toolButton: { backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, minHeight: 44, justifyContent: 'center' }, panel: { backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 14 }, filterBlock: { backgroundColor: '#e0f2fe', color: '#0369a1', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, overflow: 'hidden' }, operator: { backgroundColor: '#0f172a', color: '#fff', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, overflow: 'hidden' }, query: { fontFamily: 'Courier', color: '#475569', backgroundColor: '#f8fafc', padding: 10, borderRadius: 12, marginVertical: 8 }, search: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, marginVertical: 10, minHeight: 44 }, insightCard: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 22, padding: 16, marginBottom: 10 }, insightTone: { fontSize: 22 }, cardTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a', marginBottom: 4 }, cardBody: { color: '#475569', lineHeight: 20 }, linkText: { color: '#ea580c', fontWeight: '800', marginTop: 8 }, rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }, triageCard: { backgroundColor: '#fff', borderRadius: 28, padding: 20 }, actionRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0' }, dangerButton: { backgroundColor: '#fef2f2', borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 12 }, dangerText: { color: '#b91c1c', fontWeight: '800' }, detail: { flex: 1, backgroundColor: '#f8fafc' }, detailTitle: { fontSize: 30, fontWeight: '800', color: '#0f172a', marginBottom: 14 }, description: { minHeight: 110, backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 14, textAlignVertical: 'top' }, commentBox: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 12, marginVertical: 8 }, commentInput: { minHeight: 54 }, send: { color: '#ea580c', fontWeight: '800', alignSelf: 'flex-end' }
});
