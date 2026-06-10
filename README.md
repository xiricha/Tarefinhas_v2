# Tarefinhas v2

Aplicativo mobile-first de produtividade pessoal e colaborativa inspirado no Todoist, com foco em **capturar rápido, organizar sem esforço e executar com clareza**.

## MVP implementado

- Shell mobile com abas: Today, Upcoming, Inbox, Projects e Browse/More.
- Onboarding premium de 6 passos com proposta de valor, foco, modo, notificações, projetos sugeridos e importação.
- Quick Add persistente via FAB com parsing de linguagem natural para data, hora, recorrência, label/contexto, projeto, prioridade, lembrete e responsável.
- Inbox universal com regra de entrada automática para tarefas sem projeto e modo guiado “Processar Inbox”.
- Today com overdue, tarefas com horário, sem horário, progresso diário, Top 3/sugestão e insights leves opcionais.
- Upcoming com faixa de calendário contínua, agrupamento por dia, dias vazios visíveis e indicação de sobrecarga.
- Projects com cards de projeto, contadores, favoritos e base para views de lista/board/calendário/progresso.
- Browse/More com Search global, Filters & Labels, construtor visual de filtros, modo avançado via query equivalente, insights e Settings.
- Task Detail em modal com metadados, descrição rica, recorrência, lembretes, comentários, anexos e ações rápidas.
- Componentes reutilizáveis exigidos no PRD: TaskRow, TaskCheckbox, PriorityBadge, DateChip, LabelChip, QuickAddComposer, SwipeActionContainer, ProjectCard, SectionHeader, EmptyState, InlineFilterBuilder, CalendarStrip, ReminderPicker, RecurrenceBuilder, AttachmentPicker, CommentComposer e ProductivityCard.
- Schema SQL inicial com entidades principais, notificações, widgets e sugestões inteligentes.

## Comandos

```bash
npm test
npm start
npm run ios
npm run android
npm run web
```

## Backend planejado

A migração `supabase/migrations/001_initial_productivity_schema.sql` cobre autenticação/workspaces, tarefas, projetos, seções, labels, filtros, lembretes, comentários, anexos, activity logs, notificações, widget configs e smart suggestions. As actions do PRD mapeiam diretamente para essas tabelas: `create_task`, `quick_add_parse`, `update_task`, `complete_task`, `reschedule_task`, `create_project`, `create_filter`, `attach_file`, `add_comment`, `assign_task`, `generate_recurring_instance` e `search_everything`.
