# Research report export (Stages 5–6)

## PDF

1. **Export PDF** → `ResearchExportJob` (`type=pdf`)
2. BullMQ `research.export.pdf` (or inline without Redis)
3. Print HTML → Playwright Chromium → `putObject` / inline Bytes
4. UI polls + download (signed URL or base64)

```bash
pnpm exec playwright install chromium
```

## Excel

1. **Export Excel** → `ResearchExportJob` (`type=xlsx`)
2. BullMQ `research.export.xlsx` (or inline)
3. ExcelJS workbook via `build-xlsx.ts` → same artifact storage
4. Formula injection sanitized with shared `sanitizeFormulaInjection`

Sheets (only when data exists): Summary, Methodology, Respondents, Survey Data (inventory), Interview Insights, Charts, per-dataset tables (max 500 rows), Sources, Metadata.

Full survey response dumps remain in the survey Responses export UI.

## Cache

Reuse completed artifacts when `cacheKey` matches  
`sha256(reportId:versionId:snapshotHash:optionsHash)`.
