# Upstream Customizations Log

> Журнал отклонений форка Formbricks от upstream (`https://github.com/formbricks/formbricks`).  
> Цель: минимизировать конфликты при обновлениях и явно фиксировать каждую правку core.

**Правило:** любой touchpoint вне `apps/web/modules/research/**` и research routes обязан быть записан сюда в том же PR/коммите.

**Статус на Этапе 7:** Brand Audit (criteria template, assessments, radar/SWOT/matrices, report embed).

---

## A. Процесс работы с upstream

1. Держать remote `upstream` на официальный Formbricks; `origin` — форк агентства.
2. Обновляться регулярно небольшими merge/rebase циклами, не копить месяцы.
3. Перед merge прогонять: `pnpm lint`, `pnpm typecheck`, `pnpm test`, критичные e2e research.
4. Conflict hotspots ожидать в: `schema.prisma`, `MainNavigation.tsx`, `packages/jobs`, `locales/en-US.json`, lockfile.
5. Research-функциональность должна выключаться флагом `RESEARCH_PLATFORM_ENABLED` без поломки core surveys.
6. Не копировать и не «вырезать» код из `apps/web/modules/ee/**` в AGPL-модули без юридической оценки.

### Предпочтительные паттерны

| Паттерн | Пример |
|---------|--------|
| Новый изолированный модуль | `apps/web/modules/research/**` |
| Новые маршруты | `app/(app)/workspaces/[workspaceId]/research/**` |
| Additive Prisma models | Только новые model/enum; без изменения семантики Survey/Response |
| Composition over fork | Обёртки вокруг `getSurveySummary`, storage, jobs |
| Feature flag | Env / organization setting |
| Docs | Этот файл + architecture doc |

### Антипаттерны

- Массовый рефакторинг survey editor «заодно»
- Изменение `OrganizationRole` enum без крайней нужды
- Параллельный S3/auth/RBAC стек
- Зависимость MVP от Enterprise license gate
- Редактирование vendored `xlsx` без необходимости

---

## B. Запланированные точки интеграции (ещё не внесены)

Заполнять секцию C при фактическом изменении. Здесь — карта ожидаемых правок.

### B.1 Навигация

| Поле | Значение |
|------|----------|
| **Путь** | `apps/web/app/(app)/workspaces/[workspaceId]/components/MainNavigation.tsx` |
| **Причина** | Добавить пункт «Исследования» / Research рядом с Ask (Surveys) |
| **Планируемое изменение** | Новый `NavigationLink` + i18n ключи; условный рендер по feature flag |
| **Риск конфликта** | **Высокий** — файл часто меняется upstream (Unify, billing, nav IA) |
| **Перенос после обновления** | Перенести блок nav item вручную; сохранить feature-flag guard; сверить иконки/структуру секций Ask/Unify |

### B.2 Prisma schema

| Поле | Значение |
|------|----------|
| **Путь** | `packages/database/schema.prisma` |
| **Причина** | Модели Research (Client, Brand, ResearchProject, …) |
| **Планируемое изменение** | Additive models/enums/indexes; relations на `Organization`, `User`, `Survey`, `Workspace` |
| **Риск конфликта** | **Высокий** — schema активно эволюционирует (Workspace, Hub, Chart) |
| **Перенос после обновления** | Переносить только наш блок models в конец/отдельную секцию `// === Research Platform ===`; заново сгенерировать migration при необходимости; никогда не переписывать upstream migrations |

### B.3 Jobs registry

| Поле | Значение |
|------|----------|
| **Путь** | `packages/jobs/src/constants.ts`, `definitions.ts`; `apps/web/instrumentation-jobs.ts` / `apps/web/lib/jobs/config.ts` |
| **Причина** | Фоновая генерация PDF/XLSX |
| **Планируемое изменение** | Новые `JOB_NAMES` + handlers; wiring в web instrumentation |
| **Риск конфликта** | **Средний** |
| **Перенос после обновления** | Добавить job names аддитивно; handlers держать в `modules/research/lib/export/` |

### B.4 Locales

| Поле | Значение |
|------|----------|
| **Путь** | `apps/web/locales/en-US.json`, `apps/web/locales/ru-RU.json` (+ lingo pipeline) |
| **Причина** | UI на русском и английском |
| **Планируемое изменение** | Namespace `research.*` ключи |
| **Риск конфликта** | **Средний/высокий** (большие JSON merges) |
| **Перенос после обновления** | Держать ключи в отдельном префиксе `research`; при конфликте брать upstream + re-apply research keys |

### B.5 Action client / auth composition (возможно)

| Поле | Значение |
|------|----------|
| **Путь** | `apps/web/lib/utils/action-client/action-client-middleware.ts` (желательно **не** менять) |
| **Причина** | Единый RBAC стиль |
| **Планируемое изменение** | Предпочтительно: research ACL в `modules/research/lib/authorization.ts`, вызываемый из research actions **после** `authenticatedActionClient` + org check. Избегать правки shared middleware. |
| **Риск конфликта** | Высокий, если править shared middleware |
| **Перенос после обновления** | Не требуется при composition-подходе |

### B.6 Storage allowlists / routes (возможно)

| Поле | Значение |
|------|----------|
| **Путь** | `apps/web/modules/storage/**`, storage API routes |
| **Причина** | Prefixes `research-assets/`, `research-exports/`; MIME allowlist для аудио/видео/PDF |
| **Планируемое изменение** | Минимальные расширения validation; reuse `getSignedUploadUrl` / `getSignedDownloadUrl` |
| **Риск конфликта** | **Средний** |
| **Перенос после обновления** | Вынести research-specific validation в research module helpers, если возможно |

### B.7 Survey analysis deep-link (опционально, поздние этапы)

| Поле | Значение |
|------|----------|
| **Путь** | Survey summary components under `app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/` |
| **Причина** | Кнопка «Добавить в отчёт / Analysis block» |
| **Планируемое изменение** | Тонкая UI-кнопка + action в research module |
| **Риск конфликта** | **Средний** |
| **Перенос после обновления** | Изолированный компонент-вставка; feature flag |

### B.8 Docker / worker image (Этап 5+)

| Поле | Значение |
|------|----------|
| **Путь** | `docker/docker-compose.yml`, возможно новый Dockerfile worker |
| **Причина** | Chromium для PDF |
| **Планируемое изменение** | Отдельный research-export worker service |
| **Риск конфликта** | **Средний** |
| **Перенос после обновления** | Держать отдельный compose override `docker-compose.research.yml` |

### B.9 Dependencies

| Поле | Значение |
|------|----------|
| **Путь** | `apps/web/package.json`, `pnpm-lock.yaml` |
| **Причина** | ExcelJS (Этап 6), Playwright runtime для PDF (Этап 5) |
| **Планируемое изменение** | Точечное добавление; без массовых upgrades |
| **Риск конфликта** | **Высокий** на lockfile |
| **Перенос после обновления** | Re-add deps after upstream lock merge; не обновлять Next/Prisma «заодно» |

---

## C. Changelog фактических модификаций core

| Дата | Путь | Причина | Что изменено | Риск upstream | Как переносить |
|------|------|---------|--------------|---------------|----------------|
| 2026-07-17 | `docs/research-platform-architecture.md` | Этап 0 | Добавлен архитектурный документ | Низкий | Сохранить при merge; не из upstream |
| 2026-07-17 | `docs/upstream-customizations.md` | Этап 0 | Добавлен этот журнал | Низкий | Сохранить при merge |
| 2026-07-17 | `packages/database/schema.prisma` | Этап 1 | Additive research models/enums + reverse relations on Organization/User/Workspace/Survey | Высокий | Блок `// === Research Platform ===` переносить целиком; не трогать upstream migrations |
| 2026-07-17 | `packages/database/migration/20260717120000_add_research_platform/` | Этап 1 | Schema migration SQL | Средний | Оставить как есть; при rebase не переименовывать timestamp без нужды |
| 2026-07-17 | `apps/web/app/(app)/workspaces/[workspaceId]/components/MainNavigation.tsx` | Этап 1 | Секция Research + prop `isResearchPlatformEnabled` | Высокий | Перенести nav block + prop wiring |
| 2026-07-17 | `apps/web/app/(app)/workspaces/[workspaceId]/components/WorkspaceLayout.tsx` | Этап 1 | Передача `RESEARCH_PLATFORM_ENABLED` в MainNavigation | Средний | Повторить prop |
| 2026-07-17 | `apps/web/lib/env.ts`, `apps/web/lib/constants.ts`, `.env.example` | Этап 1 | `RESEARCH_PLATFORM_ENABLED` | Низкий | Добавить env key заново |
| 2026-07-17 | `apps/web/locales/en-US.json`, `ru-RU.json` | Этап 1 | Namespace `research.*` | Высокий (JSON merge) | Сохранить ключи `research`; при конфликте взять upstream + re-apply research |
| 2026-07-17 | `apps/web/modules/research/**`, `app/.../research/**` | Этап 1 | Новый изолированный модуль + routes | Низкий | Целиком наш код |
| 2026-07-17 | `packages/database/schema.prisma` | Этап 2 | Interview/Transcript/Code/Insight models | Высокий | Блок Research Platform расширить аддитивно |
| 2026-07-17 | `packages/database/migration/20260717130000_add_research_interviews_insights/` | Этап 2 | Schema migration | Средний | Сохранить |
| 2026-07-17 | `apps/web/modules/research/lib/{interviews,codes,insights,transcript-parser,ai}/**` | Этап 2 | Qualitative services + AI stubs | Низкий | Наш код |
| 2026-07-17 | `apps/web/modules/research/components/*interview*`, `*insight*` | Этап 2 | UI coding workspace | Низкий | Наш код |
| 2026-07-17 | `app/.../research/.../interviews/**`, `insights/**` | Этап 2 | Routes | Низкий | Наш код |
| 2026-07-17 | `apps/web/locales/en-US.json`, `ru-RU.json` | Этап 2 | qualitative i18n keys | Высокий | Re-apply `research.interviews/insights/coding/ai` |
| 2026-07-17 | `packages/database/schema.prisma` + `migration/20260717140000_add_research_analysis_workspace/` | Этап 3 | Dataset + AnalysisBlock | Высокий | Additive block |
| 2026-07-17 | `apps/web/modules/research/lib/analysis/**`, `types/chart-definition.ts` | Этап 3 | ChartDefinition + aggregations | Низкий | Наш код |
| 2026-07-17 | `apps/web/modules/research/components/research-analysis-workspace.tsx` | Этап 3 | Analysis UI | Низкий | Наш код |
| 2026-07-17 | `app/.../research/.../analysis/page.tsx` | Этап 3 | Route | Низкий | Наш код |
| 2026-07-17 | locales | Этап 3 | `research.analysis.*` | Высокий | Re-apply keys |
| 2026-07-18 | `packages/database/schema.prisma` + `migration/20260717150000_add_research_report_builder/` | Этап 4 | Report/Block/Version/Theme | Высокий | Additive block |
| 2026-07-18 | `apps/web/modules/research/lib/reports/**`, `types/report.ts` | Этап 4 | Report services + Zod | Низкий | Наш код |
| 2026-07-18 | `apps/web/modules/research/components/research-report-*.tsx` | Этап 4 | DnD builder + preview | Низкий | Наш код |
| 2026-07-18 | `app/.../research/.../reports/**` | Этап 4 | Routes | Низкий | Наш код |
| 2026-07-18 | locales | Этап 4 | `research.reports.*` | Высокий | Re-apply keys |
| 2026-07-18 | `packages/database/schema.prisma` + `migration/20260717160000_add_research_export_jobs/` | Этап 5 | ExportJob/Artifact | Высокий | Additive |
| 2026-07-18 | `packages/storage` (`putObject`) | Этап 5 | Server-side S3 upload | Средний | Перенести helper |
| 2026-07-18 | `packages/jobs` (`research.export.pdf`) | Этап 5 | Job name + stub + enqueue | Средний | Additive JOB_NAMES |
| 2026-07-18 | `apps/web/instrumentation-jobs.ts` | Этап 5 | Handler override | Средний | Добавить override |
| 2026-07-18 | `apps/web/modules/research/lib/export/**` | Этап 5 | Print HTML + PDF pipeline | Низкий | Наш код |
| 2026-07-18 | `apps/web/package.json` (`playwright`) | Этап 5 | Runtime Chromium for PDF | Средний | + `playwright install chromium` |
| 2026-07-18 | locales | Этап 5 | export i18n | Высокий | Re-apply keys |
| 2026-07-18 | `apps/web/package.json` (`exceljs`) | Этап 6 | Report XLSX builder | Средний | Additive dep |
| 2026-07-18 | `apps/web/lib/utils/file-conversion.ts` | Этап 6 | export `sanitizeFormulaInjection` | Низкий | Re-export helper |
| 2026-07-18 | `packages/jobs` (`research.export.xlsx`) | Этап 6 | Job + enqueue | Средний | Additive |
| 2026-07-18 | `apps/web/instrumentation-jobs.ts` | Этап 6 | XLSX handler override | Средний | Добавить override |
| 2026-07-18 | `apps/web/modules/research/lib/export/build-*.ts` | Этап 6 | Workbook builder | Низкий | Наш код |
| 2026-07-18 | locales | Этап 6 | xlsx i18n | Высокий | Re-apply keys |
| 2026-07-18 | `packages/database/schema.prisma` + `migration/20260717170000_add_research_brand_audit/` | Этап 7 | BrandAudit* + report block enum | Высокий | Additive |
| 2026-07-18 | `apps/web/modules/research/lib/brand-audit/**` | Этап 7 | Services + score helpers | Низкий | Наш код |
| 2026-07-18 | `apps/web/modules/research/components/*brand-audit*` | Этап 7 | UI radar/SWOT/table | Низкий | Наш код |
| 2026-07-18 | `app/.../brand-audit/**` | Этап 7 | Routes | Низкий | Наш код |
| 2026-07-18 | locales | Этап 7 | `research.brand_audit.*` | Высокий | Re-apply keys |

---

## D. Файлы / области, которые обещаем не трогать без причины

- `packages/surveys/**`, `packages/js-core/**` — runtime опросов  
- `modules/auth/lib/auth.ts` — better-auth core  
- Response pipeline processors (кроме регистрации новых jobs рядом)  
- EE modules (`modules/ee/**`) — не форкать для research MVP  
- Существующий `convertToXlsxBuffer` behavior (можно reuse sanitize helper, не ломать API)  
- Cube schema / Hub — опциональная интеграция позже, не блокер MVP  

---

## E. Шаблон записи для будущих PR

```markdown
| YYYY-MM-DD | `path/to/file` | Зачем | Кратко что сделали | Low/Med/High | Шаги rebase |
```

Дополнительно в PR description: ссылка на этап roadmap (1–7) и feature flag.
)
