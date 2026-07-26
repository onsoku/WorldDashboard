import type { Plugin } from 'vite'
import { spawn } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import path from 'path'
import { log as slog } from './job-logger'
import { updateIndex, removeFromIndex } from './index-writer'
import {
  loadAllJobs, persistJobDebounced, flushJob, deleteJob as deletePersistedJob,
} from './job-store'
import { isValidSlug, resolveDataPath } from './slug'
import { repairJsonFile, repairJsonString } from './json-repair'

interface LogEntry {
  timestamp: string;
  message: string;
  phase: 'start' | 'web-search' | 'paper-search' | 'synthesis' | 'writing' | 'done' | 'error';
}

interface ResearchJob {
  jobId: string;
  topic: string;
  status: 'running' | 'completed' | 'error';
  startedAt: string;
  completedAt?: string;
  message?: string;
  logs: LogEntry[];
  lang: string;
  writtenFiles: string[];
  mode?: 'research' | 'translate' | 'update';
  // Pre-known slug for translate/update modes; for fresh research it's
  // derived from writtenFiles when the job completes.
  slug?: string;
}

const LOG_MESSAGES: Record<string, Record<string, string>> = {
  ja: {
    'start': '調査を開始しました',
    'skill': '調査スキルを実行中...',
    'web-search': 'Web検索',
    'fetch-page': 'ページ取得',
    'paper-search': '論文データベース検索中...',
    'index-read': 'トピック一覧を読み込み中...',
    'index-write': 'トピック一覧を更新中...',
    'data-write': '調査データを書き出し中...',
    'synthesis': '収集データを分析・要約中...',
    'done': '調査が完了しました',
    'done-max': '調査が完了しました（ターン上限に達しました）',
    'complete': '調査完了',
  },
  en: {
    'start': 'Research started',
    'skill': 'Running research skill...',
    'web-search': 'Web search',
    'fetch-page': 'Fetching page',
    'paper-search': 'Searching academic databases...',
    'index-read': 'Reading topic index...',
    'index-write': 'Updating topic index...',
    'data-write': 'Writing research data...',
    'synthesis': 'Analyzing and summarizing data...',
    'done': 'Research completed',
    'done-max': 'Research completed (turn limit reached)',
    'complete': 'Research complete',
  },
  zh: {
    'start': '开始研究',
    'skill': '正在执行研究技能...',
    'web-search': '网络搜索',
    'fetch-page': '获取页面',
    'paper-search': '正在搜索学术数据库...',
    'index-read': '正在读取主题索引...',
    'index-write': '正在更新主题索引...',
    'data-write': '正在写入研究数据...',
    'synthesis': '正在分析和总结数据...',
    'done': '研究完成',
    'done-max': '研究完成（达到轮次上限）',
    'complete': '研究完成',
  },
  es: {
    'start': 'Investigacion iniciada',
    'skill': 'Ejecutando habilidad de investigacion...',
    'web-search': 'Busqueda web',
    'fetch-page': 'Obteniendo pagina',
    'paper-search': 'Buscando en bases de datos academicas...',
    'index-read': 'Leyendo indice de temas...',
    'index-write': 'Actualizando indice de temas...',
    'data-write': 'Escribiendo datos de investigacion...',
    'synthesis': 'Analizando y resumiendo datos...',
    'done': 'Investigacion completada',
    'done-max': 'Investigacion completada (limite de turnos)',
    'complete': 'Investigacion completa',
  },
  it: {
    'start': 'Ricerca avviata',
    'skill': 'Esecuzione abilita di ricerca...',
    'web-search': 'Ricerca web',
    'fetch-page': 'Recupero pagina',
    'paper-search': 'Ricerca nei database accademici...',
    'index-read': 'Lettura indice argomenti...',
    'index-write': 'Aggiornamento indice argomenti...',
    'data-write': 'Scrittura dati di ricerca...',
    'synthesis': 'Analisi e sintesi dei dati...',
    'done': 'Ricerca completata',
    'done-max': 'Ricerca completata (limite turni raggiunto)',
    'complete': 'Ricerca completata',
  },
  fr: {
    'start': 'Recherche lancee',
    'skill': 'Execution de la competence de recherche...',
    'web-search': 'Recherche web',
    'fetch-page': 'Recuperation de la page',
    'paper-search': 'Recherche dans les bases de donnees academiques...',
    'index-read': 'Lecture de l\'index des sujets...',
    'index-write': 'Mise a jour de l\'index des sujets...',
    'data-write': 'Ecriture des donnees de recherche...',
    'synthesis': 'Analyse et synthese des donnees...',
    'done': 'Recherche terminee',
    'done-max': 'Recherche terminee (limite de tours atteinte)',
    'complete': 'Recherche terminee',
  },
};

function msg(lang: string, key: string): string {
  return LOG_MESSAGES[lang]?.[key] ?? LOG_MESSAGES['en']?.[key] ?? key;
}

const jobs = new Map<string, ResearchJob>();

/**
 * Generate a job id prefix. Deliberately ignores the topic — deriving it from
 * non-ASCII topic text caused URL encoding problems, so it is purely random.
 */
function newJobPrefix(): string {
  return 'job-' + Math.random().toString(36).slice(2, 10);
}

function addLog(job: ResearchJob, phase: LogEntry['phase'], message: string) {
  job.logs.push({ timestamp: new Date().toISOString(), phase, message });
  persistJobDebounced(job.jobId, job);
}

/** Read meta.topic from a written data file. Falls back to null if missing. */
function readTopicFromDataFile(slug: string): string | null {
  try {
    const p = path.join(process.cwd(), 'public', 'data', `${slug}.json`);
    const raw = readFileSync(p, 'utf-8');
    const data = JSON.parse(raw) as { meta?: { topic?: unknown } };
    return typeof data.meta?.topic === 'string' ? data.meta.topic : null;
  } catch {
    return null;
  }
}

function resolveSlug(job: ResearchJob): string | undefined {
  if (job.slug) return job.slug;
  const dataFiles = job.writtenFiles.filter(f => !f.includes('index.json') && f.endsWith('.json'));
  if (dataFiles.length === 0) return undefined;
  return path.basename(dataFiles[dataFiles.length - 1], '.json');
}

/**
 * Called once a job reaches a terminal state. Logs exit, updates index.json
 * via the mutex-protected writer, and flushes the persisted job to disk.
 */
async function finalizeJob(job: ResearchJob, exit: { code?: number | null; signal?: NodeJS.Signals | null; reason?: string }): Promise<void> {
  markDone(job);
  const slug = resolveSlug(job);
  if (slug) job.slug = slug;

  slog(job.status === 'error' ? 'warn' : 'info', 'job.exit', {
    jobId: job.jobId,
    topic: job.topic,
    status: job.status,
    mode: job.mode,
    slug,
    exitCode: exit.code ?? null,
    signal: exit.signal ?? null,
    reason: exit.reason,
    durationMs: job.completedAt && job.startedAt
      ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
      : null,
    writtenFiles: job.writtenFiles.length,
  });

  if (job.status === 'completed' && slug) {
    const topic = readTopicFromDataFile(slug) ?? job.topic;
    try {
      await updateIndex({
        slug,
        topic,
        isUpdate: job.mode === 'update',
        jobId: job.jobId,
      });
      addLog(job, 'writing', `index.json更新完了: ${slug}`);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      addLog(job, 'error', `index.json更新失敗: ${errMsg}`);
      // Don't flip status to error — the data file was written; only the
      // index update failed. Surface it in logs for triage.
      slog('error', 'index.update_failed', { jobId: job.jobId, slug, error: errMsg });
    }
  } else if (job.status === 'completed' && !slug) {
    slog('warn', 'job.completed_without_slug', {
      jobId: job.jobId,
      topic: job.topic,
      writtenFiles: job.writtenFiles,
    });
    addLog(job, 'error', 'データファイルが見つかりませんでした (index.json更新スキップ)');
  }

  flushJob(job.jobId, job);
}

/**
 * Validate a JSON file written by Claude CLI and repair common issues in
 * place. Conservative by design — see server/json-repair.ts.
 */
function validateAndRepairJson(filePath: string): { valid: boolean; repaired?: boolean; error?: string } {
  const result = repairJsonFile(filePath);
  if (result.repaired) {
    slog('info', 'json.auto_repaired', { filePath });
  } else if (!result.valid) {
    slog('warn', 'json.invalid', { filePath, error: result.error });
  }
  return { valid: result.valid, repaired: result.repaired, error: result.error };
}

function markDone(job: ResearchJob) {
  if (!job.completedAt) job.completedAt = new Date().toISOString();
}

function pruneOldJobs() {
  // Keep completed/error jobs for 24h to allow history review.
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [id, j] of jobs) {
    if (j.status !== 'running' && j.completedAt && new Date(j.completedAt).getTime() < cutoff) {
      jobs.delete(id);
      deletePersistedJob(id);
    }
  }
}

function parseStreamLine(line: string, job: ResearchJob) {
  const L = job.lang;
  try {
    const event = JSON.parse(line);

    if (event.type === 'assistant' && event.message?.content) {
      for (const block of event.message.content) {
        if (block.type === 'tool_use') {
          const toolName: string = block.name ?? '';
          const input = block.input ?? {};

          if (toolName === 'WebSearch') {
            const query = input.query ?? '';
            addLog(job, 'web-search', `${msg(L, 'web-search')}: ${query}`);
          } else if (toolName === 'WebFetch') {
            const url: string = input.url ?? '';
            if (url.includes('semanticscholar')) {
              addLog(job, 'paper-search', msg(L, 'paper-search'));
            } else {
              addLog(job, 'web-search', `${msg(L, 'fetch-page')}: ${url.slice(0, 60)}...`);
            }
          } else if (toolName === 'Write') {
            const filePath: string = input.file_path ?? '';
            if (filePath.includes('index.json')) {
              // The CLI is now instructed not to touch index.json. If we see
              // this, the prompt failed — log it so we can tighten the prompt
              // and so the user has evidence in #26 follow-ups.
              slog('warn', 'cli.wrote_index', { jobId: job.jobId, filePath, topic: job.topic });
              addLog(job, 'writing', msg(L, 'index-write'));
            } else if (filePath.includes('.json')) {
              addLog(job, 'writing', msg(L, 'data-write'));
              job.writtenFiles.push(filePath);
              slog('info', 'cli.wrote_data', { jobId: job.jobId, filePath });
            }
          } else if (toolName === 'Read') {
            const filePath: string = input.file_path ?? '';
            if (filePath.includes('index.json')) {
              addLog(job, 'writing', msg(L, 'index-read'));
            }
          } else if (toolName === 'Skill') {
            addLog(job, 'start', msg(L, 'skill'));
          }
        }

        if (block.type === 'text' && job.logs.length > 0) {
          const lastPhase = job.logs[job.logs.length - 1].phase;
          if (lastPhase === 'web-search' || lastPhase === 'paper-search') {
            const hasWriteLog = job.logs.some(l => l.phase === 'writing');
            if (!hasWriteLog) {
              const hasSynthesisLog = job.logs.some(l => l.phase === 'synthesis');
              if (!hasSynthesisLog) {
                addLog(job, 'synthesis', msg(L, 'synthesis'));
              }
            }
          }
        }
      }
    }

    if (event.type === 'result') {
      if (event.subtype === 'success' && !event.is_error) {
        job.status = 'completed';
        job.message = `${msg(L, 'complete')}: ${job.topic}`;
        addLog(job, 'done', msg(L, 'done'));
      } else if (event.subtype === 'error_max_turns') {
        job.status = 'completed';
        job.message = `${msg(L, 'complete')}: ${job.topic}`;
        addLog(job, 'done', msg(L, 'done-max'));
      } else {
        job.status = 'error';
        job.message = (event.result as string | undefined)?.slice(0, 500) ?? `Error: ${event.subtype ?? 'unknown'}`;
        addLog(job, 'error', job.message);
        slog('warn', 'cli.result_error', {
          jobId: job.jobId,
          subtype: event.subtype,
          message: job.message,
        });
      }
      // Don't call markDone here — finalizeJob is the single termination
      // hook and handles index.json + persistence. The 'close' handler
      // calls finalizeJob once the subprocess exits.
    }
  } catch (e) {
    // The Claude CLI occasionally emits non-JSON debug lines. Log a sample
    // (truncated) so we can tighten the parser if a real signal is being
    // dropped, but stay at debug level to avoid noise.
    slog('debug', 'stream.parse_error', {
      jobId: job.jobId,
      error: e instanceof Error ? e.message : String(e),
      sample: line.slice(0, 200),
    });
  }
}

export function researchApiPlugin(): Plugin {
  return {
    name: 'research-api',
    configureServer(server) {
      // Rehydrate persisted jobs from .claude/jobs so completed/error history
      // and in-flight metadata survive Vite dev-server restarts (issue #24).
      // Subprocesses are gone, so anything still 'running' on disk is marked
      // as interrupted by loadAllJobs() before we see it here.
      for (const { jobId, job } of loadAllJobs()) {
        jobs.set(jobId, job as unknown as ResearchJob);
      }
      slog('info', 'plugin.ready', {
        restoredJobs: jobs.size,
        pid: process.pid,
      });

      // Import API endpoint
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (url !== '/api/import' || req.method !== 'POST') return next();

        res.setHeader('Content-Type', 'application/json');
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          (async () => {
            try {
              const data = JSON.parse(body);
              if (!data?.meta?.topic || !data?.meta?.slug) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid data: meta.topic and meta.slug are required' }));
                return;
              }

              const slug: string = data.meta.slug;
              const topic: string = data.meta.topic;
              const projectRoot = process.cwd();
              const dataDir = path.join(projectRoot, 'public', 'data');

              // meta.slug comes straight from an uploaded file, so it is fully
              // attacker-controlled — validate before it ever reaches the
              // filesystem (issue #35).
              const targetPath = resolveDataPath(dataDir, slug);
              if (!targetPath) {
                slog('warn', 'import.invalid_slug', { slug: String(slug).slice(0, 100) });
                res.statusCode = 400;
                res.end(JSON.stringify({ error: `Invalid slug: ${slug}` }));
                return;
              }

              // Write topic data
              writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf-8');
              // Route index.json updates through the shared mutex.
              await updateIndex({ slug, topic });
              slog('info', 'import.success', { slug, topic });

              res.statusCode = 200;
              res.end(JSON.stringify({ slug, topic, status: 'imported' }));
            } catch (e) {
              slog('warn', 'import.failed', { error: e instanceof Error ? e.message : String(e) });
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          })().catch(() => { /* response already sent */ });
        });
      });

      // Delete topic API endpoint
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        const deleteMatch = url.match(/^\/api\/topic\/([^/?]+)$/);
        if (!deleteMatch || req.method !== 'DELETE') return next();

        res.setHeader('Content-Type', 'application/json');
        const slug = decodeURIComponent(deleteMatch[1]);
        const projectRoot = process.cwd();
        const dataDir = path.join(projectRoot, 'public', 'data');

        const filePath = resolveDataPath(dataDir, slug);
        if (!filePath) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid slug' }));
          return;
        }

        (async () => {
          try {
            if (existsSync(filePath)) {
              unlinkSync(filePath);
            }
            await removeFromIndex(slug);
            slog('info', 'topic.delete', { slug });
            res.statusCode = 200;
            res.end(JSON.stringify({ slug, status: 'deleted' }));
          } catch (e) {
            slog('error', 'topic.delete_failed', { slug, error: e instanceof Error ? e.message : String(e) });
            res.statusCode = 500;
            res.end(JSON.stringify({ error: `Delete failed: ${e instanceof Error ? e.message : String(e)}` }));
          }
        })().catch(() => { /* response already sent */ });
      });

      // Repair topic API endpoint
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        const repairMatch = url.match(/^\/api\/repair\/([^/?]+)$/);
        if (!repairMatch || req.method !== 'POST') return next();

        res.setHeader('Content-Type', 'application/json');
        const slug = decodeURIComponent(repairMatch[1]);
        const projectRoot = process.cwd();
        const dataDir = path.join(projectRoot, 'public', 'data');

        const filePath = resolveDataPath(dataDir, slug);
        if (!filePath) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid slug' }));
          return;
        }

        if (!existsSync(filePath)) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'File not found' }));
          return;
        }

        const raw = readFileSync(filePath, 'utf-8');
        // The user asked for this repair explicitly, so allow the aggressive
        // strategies (unescaped newlines, truncation recovery).
        const result = repairJsonString(raw, { aggressive: true });

        if (result.valid && !result.repaired) {
          res.statusCode = 200;
          res.end(JSON.stringify({ slug, status: 'already_valid' }));
          return;
        }

        if (result.valid && result.fixed !== undefined) {
          writeFileSync(filePath, result.fixed, 'utf-8');
          slog('info', 'json.repaired', { slug, filePath });
          res.statusCode = 200;
          res.end(JSON.stringify({ slug, status: 'repaired' }));
          return;
        }

        slog('warn', 'json.unrepairable', { slug, error: result.error });
        res.statusCode = 422;
        res.end(JSON.stringify({ slug, status: 'unrepairable', error: 'Automatic repair failed. Consider deleting this topic.' }));
      });

      // Export PDF API endpoint — bundles one or more topics into a single PDF.
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (url !== '/api/export-pdf' || req.method !== 'POST') return next();

        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          let slugs: string[] = [];
          try {
            const parsed = JSON.parse(body);
            slugs = Array.isArray(parsed?.slugs) ? parsed.slugs : [];
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
            return;
          }
          if (slugs.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'At least one slug required' }));
            return;
          }
          // Validate slugs — reject anything path-traversal-y or with separators.
          const projectRoot = process.cwd();
          const dataDir = path.join(projectRoot, 'public', 'data');
          for (const s of slugs) {
            const dataPath = resolveDataPath(dataDir, s);
            if (!dataPath) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `Invalid slug: ${s}` }));
              return;
            }
            if (!existsSync(dataPath)) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `Unknown slug: ${s}` }));
              return;
            }
          }

          // Resolve port from the vite http server.
          const httpServer = server.httpServer;
          const address = httpServer?.address();
          const port = address && typeof address === 'object' ? address.port : null;
          if (!port) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Dev server port unavailable' }));
            return;
          }

          try {
            const puppeteer = (await import('puppeteer')).default;
            const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
            try {
              const page = await browser.newPage();
              await page.setViewport({ width: 1024, height: 1400 });
              const printUrl = `http://localhost:${port}/print?slugs=${encodeURIComponent(slugs.join(','))}`;
              await page.goto(printUrl, { waitUntil: 'networkidle2', timeout: 60000 });
              await page.waitForFunction(
                'window.__PRINT_READY__ === true',
                { timeout: 30000 },
              );
              const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
              });

              const firstSlug = slugs[0];
              const filename = slugs.length === 1 ? `${firstSlug}.pdf` : `encyclopedia-${slugs.length}-topics.pdf`;
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
              res.setHeader('Content-Length', String(pdfBuffer.length));
              res.end(pdfBuffer);
            } finally {
              await browser.close();
            }
          } catch (e) {
            console.error('[research-api] PDF export failed:', e);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `PDF export failed: ${e instanceof Error ? e.message : String(e)}` }));
          }
        });
      });

      // Translate API endpoint
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (url !== '/api/translate' || req.method !== 'POST') return next();

        res.setHeader('Content-Type', 'application/json');
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { sourceSlug, targetLang } = JSON.parse(body);
            if (!sourceSlug || !targetLang) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'sourceSlug and targetLang are required' }));
              return;
            }
            // sourceSlug is read from disk and embedded in the CLI prompt, so an
            // unvalidated value leaks arbitrary files into the request (#35).
            if (!isValidSlug(sourceSlug)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: `Invalid slug: ${sourceSlug}` }));
              return;
            }

            // Check concurrent job limit
            const MAX_CONCURRENT = 3;
            const runningJobs = [...jobs.values()].filter(j => j.status === 'running');
            if (runningJobs.length >= MAX_CONCURRENT) {
              res.statusCode = 409;
              res.end(JSON.stringify({ error: `同時実行数の上限（${MAX_CONCURRENT}）に達しています`, runningTopics: runningJobs.map(j => j.topic) }));
              return;
            }

            const projectRoot = process.cwd();
            const dataDir = path.join(projectRoot, 'public', 'data');

            let sourceData: string;
            let sourceTopic: string;
            try {
              sourceData = readFileSync(path.join(dataDir, `${sourceSlug}.json`), 'utf-8');
              sourceTopic = JSON.parse(sourceData).meta?.topic ?? sourceSlug;
            } catch {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: `Source topic "${sourceSlug}" not found` }));
              return;
            }

            const newSlug = `${sourceSlug}-${targetLang}`;
            const jobId = newJobPrefix() + '-' + Date.now();

            const LANG_NAMES: Record<string, string> = {
              ja: 'Japanese', en: 'English', zh: 'Chinese (Simplified)',
              es: 'Spanish', it: 'Italian', fr: 'French',
            };
            const targetLangName = LANG_NAMES[targetLang] ?? targetLang;

            const job: ResearchJob = {
              jobId,
              topic: `${sourceTopic} → ${targetLangName}`,
              status: 'running',
              startedAt: new Date().toISOString(),
              logs: [],
              lang: targetLang,
              writtenFiles: [],
              mode: 'translate',
              slug: newSlug,
            };
            jobs.set(jobId, job);
            addLog(job, 'start', `${msg(targetLang, 'start')}: ${sourceTopic} → ${targetLangName}`);
            slog('info', 'job.start', {
              jobId, mode: 'translate', topic: job.topic,
              sourceSlug, targetLang, newSlug,
            });

            const tmpDir = path.join(projectRoot, '.claude', 'tmp');
            mkdirSync(tmpDir, { recursive: true });
            const promptFile = path.join(tmpDir, `prompt-${jobId}.txt`);

            let skillInstructions = '';
            try {
              skillInstructions = readFileSync(
                path.join(projectRoot, '.claude', 'skills', 'research', 'SKILL.md'),
                'utf-8'
              );
            } catch { /* Skill file not found */ }

            const systemPrompt = [
              'You are a translation assistant with cultural awareness.',
              '',
              '=== TRANSLATION MODE ===',
              `Translate the following research topic from its original language to ${targetLangName}.`,
              `Output slug: "${newSlug}"`,
              `Include "sourceSlug": "${sourceSlug}", "sourceLang": "${targetLang}", and "lang": "${targetLang}" in the meta object.`,
              '',
              'CRITICAL: This is NOT a simple word-for-word translation. Follow these phases:',
              '',
              'Phase 0: Cultural Difference Assessment',
              '- Read the source data below',
              '- For each section, determine if:',
              '  (A) Direct translation is sufficient',
              '  (B) Cultural annotation is needed (e.g., explaining unfamiliar concepts)',
              '  (C) Additional research is required (e.g., "Napolitan spaghetti" translated to Italian needs context that this is a Japanese dish, not Neapolitan)',
              '- Log your assessment before proceeding',
              '',
              'Phase 1: Translation',
              '- Translate overview (summary, keyFindings, significance) to ' + targetLangName,
              '- Translate keywords terms to ' + targetLangName,
              '- Translate ochiaiSummary fields to ' + targetLangName,
              '- Translate extension content (table headers/rows, timeline titles/descriptions) to ' + targetLangName,
              '- Keep paper titles, author names, URLs, and paperId as-is (do NOT translate)',
              '- Keep all numeric data (citationCount, relevance scores, chart data) as-is',
              '- Use Markdown formatting in summary (tables, bold, headings)',
              '',
              'Phase 2: Supplementary Research (only if Phase 0 identified pattern C)',
              '- Use WebSearch to find how this topic is perceived in the target language/culture',
              '- Add cultural context notes to the summary',
              '- If the topic has a different name or connotation in the target culture, explain this',
              '',
              `ALL output text must be in ${targetLangName}.`,
              '',
              '=== SOURCE DATA ===',
              sourceData,
              '=== END SOURCE DATA ===',
              '',
              'Follow the skill instructions below for JSON output format:',
              '',
              // Same index.json guard as the research prompt (issue #26).
              'CRITICAL: DO NOT read or write public/data/index.json. The server updates index.json automatically once your data file is written.',
              '',
              skillInstructions,
              '',
              `IMPORTANT: Write output files to ${dataDir.replace(/\\/g, '/')}`,
              `Output slug must be "${newSlug}"`,
              'IMPORTANT: Only write the single data file. Do not touch index.json.',
            ].join('\n');

            writeFileSync(promptFile, systemPrompt, 'utf-8');

            const child = spawn('claude', [
              '-p', 'Execute the translation task described in the system prompt.',
              '--system-prompt-file', promptFile,
              '--allowedTools', 'WebSearch,WebFetch,Read,Write',
              '--max-turns', '20',
              '--output-format', 'stream-json',
              '--verbose',
            ], {
              cwd: projectRoot,
              shell: true,
              stdio: ['ignore', 'pipe', 'pipe'],
              env: {
                ...process.env,
                HOME: process.env.HOME ?? process.env.USERPROFILE ?? '',
                USERPROFILE: process.env.USERPROFILE ?? '',
                APPDATA: process.env.APPDATA ?? '',
                LOCALAPPDATA: process.env.LOCALAPPDATA ?? '',
              },
            });

            let stdoutBuffer = '';
            child.stdout?.on('data', (data: Buffer) => {
              stdoutBuffer += data.toString();
              const lines = stdoutBuffer.split('\n');
              stdoutBuffer = lines.pop() ?? '';
              for (const line of lines) {
                if (line.trim()) parseStreamLine(line.trim(), job);
              }
            });

            let stderrBuffer = '';
            child.stderr?.on('data', (data: Buffer) => {
              const chunk = data.toString();
              stderrBuffer += chunk;
              // Record full stderr in the log file (truncated job.message
              // already drops anything past 300 chars).
              slog('debug', 'cli.stderr', { jobId, chunk: chunk.slice(0, 1000) });
            });

            child.on('close', (code, signal) => {
              if (stdoutBuffer.trim()) parseStreamLine(stdoutBuffer.trim(), job);
              if (job.status === 'running') {
                if (code === 0) {
                  job.status = 'completed';
                  job.message = `Translation complete: ${sourceTopic} → ${targetLangName}`;
                  addLog(job, 'done', job.message);
                } else {
                  job.status = 'error';
                  job.message = stderrBuffer.trim().slice(0, 300) || `Process exited with code ${code}`;
                  addLog(job, 'error', job.message);
                }
              }
              // Validate written JSON files after translation completes
              if (job.status === 'completed' && job.writtenFiles.length > 0) {
                for (const fp of job.writtenFiles) {
                  const { valid, repaired, error: jsonErr } = validateAndRepairJson(fp);
                  const filename = path.basename(fp);
                  if (repaired) {
                    addLog(job, 'writing', `JSON自動修復: ${filename}`);
                  } else if (!valid) {
                    addLog(job, 'error', `JSONバリデーションエラー (${filename}): ${jsonErr}`);
                  }
                }
              }
              void finalizeJob(job, { code, signal, reason: 'subprocess close' });
            });

            child.on('error', (err) => {
              job.status = 'error';
              job.message = `Claude CLI failed: ${err.message}`;
              addLog(job, 'error', job.message);
              slog('error', 'cli.spawn_error', { jobId, error: err.message });
              void finalizeJob(job, { reason: 'spawn error' });
            });

            res.statusCode = 202;
            res.end(JSON.stringify({ jobId, topic: job.topic, slug: newSlug, status: 'running' }));
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
      });

      // Research API endpoint
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/research')) return next();

        res.setHeader('Content-Type', 'application/json');

        // Skip the per-2s GET /api/research heartbeat — it produces ~43k
        // lines/day otherwise. Still log every POST + every job-specific GET
        // so we can correlate failures with client activity.
        const isHeartbeat = req.method === 'GET' && /^\/api\/research\/?(\?.*)?$/.test(url);
        if (!isHeartbeat) {
          slog('info', 'http.request', { method: req.method, url, jobCount: jobs.size });
        }

        // GET /api/research/:jobId — get specific job status + logs
        const jobIdMatch = url.match(/^\/api\/research\/(.+?)(?:\?.*)?$/);
        if (req.method === 'GET' && jobIdMatch) {
          const jobId = decodeURIComponent(jobIdMatch[1]);
          const job = jobs.get(jobId);
          if (!job) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Job not found' }));
            return;
          }
          // Strip writtenFiles + jobId (jobId is the response key already)
          // and re-derive slug from the last written data file as a fallback
          // for jobs that didn't pre-set job.slug.
          const { writtenFiles, jobId: _omit, ...jobData } = job;
          void _omit;
          const dataFiles = writtenFiles.filter(f => !f.includes('index.json') && f.endsWith('.json'));
          const derived = dataFiles.length > 0 ? path.basename(dataFiles[dataFiles.length - 1], '.json') : undefined;
          res.end(JSON.stringify({ jobId, ...jobData, slug: jobData.slug ?? derived }));
          return;
        }

        // GET /api/research — list all jobs
        if (req.method === 'GET' && url.match(/^\/api\/research\/?(\?.*)?$/)) {
          pruneOldJobs();
          const all: Record<string, Omit<ResearchJob, 'writtenFiles' | 'jobId'> & { slug?: string }> = {};
          for (const [id, j] of jobs) {
            const { writtenFiles, jobId: _omit, ...jData } = j;
            void _omit;
            const dataFiles = writtenFiles.filter(f => !f.includes('index.json') && f.endsWith('.json'));
            const derived = dataFiles.length > 0 ? path.basename(dataFiles[dataFiles.length - 1], '.json') : undefined;
            all[id] = { ...jData, slug: jData.slug ?? derived };
          }
          res.end(JSON.stringify({ jobs: all }));
          return;
        }

        if (req.method === 'POST' && url.match(/^\/api\/research\/?$/)) {
          let body = '';
          req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const { topic, language, parentSlug, mode, slug: existingSlug } = JSON.parse(body);
              if (!topic || typeof topic !== 'string') {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'topic is required' }));
                return;
              }
              const lang: string = language ?? 'ja';
              if (existingSlug !== undefined && !isValidSlug(existingSlug)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: `Invalid slug: ${existingSlug}` }));
                return;
              }
              if (parentSlug !== undefined && parentSlug !== '' && !isValidSlug(parentSlug)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: `Invalid slug: ${parentSlug}` }));
                return;
              }
              const isUpdate = mode === 'update' && existingSlug;

              const jobId = newJobPrefix() + '-' + Date.now();

              const MAX_CONCURRENT = 3;
              const running = [...jobs.values()].filter(j => j.status === 'running');
              if (running.length >= MAX_CONCURRENT) {
                res.statusCode = 409;
                res.end(JSON.stringify({ error: `同時実行数の上限（${MAX_CONCURRENT}）に達しています`, runningTopics: running.map(j => j.topic) }));
                return;
              }

              const job: ResearchJob = {
                jobId,
                topic,
                status: 'running',
                startedAt: new Date().toISOString(),
                logs: [],
                lang,
                writtenFiles: [],
                mode: isUpdate ? 'update' : 'research',
                slug: isUpdate ? existingSlug : undefined,
              };
              jobs.set(jobId, job);

              addLog(job, 'start', `${msg(lang, 'start')}: ${topic}`);
              slog('info', 'job.start', {
                jobId, mode: job.mode, topic, lang,
                parentSlug: parentSlug ?? null,
                existingSlug: isUpdate ? existingSlug : null,
                concurrentRunning: running.length + 1,
              });

              const projectRoot = process.cwd();

              // Write prompt to a temp file to avoid shell escaping issues
              const tmpDir = path.join(projectRoot, '.claude', 'tmp');
              mkdirSync(tmpDir, { recursive: true });
              const promptFile = path.join(tmpDir, `prompt-${jobId}.txt`);

              let skillInstructions = '';
              try {
                skillInstructions = readFileSync(
                  path.join(projectRoot, '.claude', 'skills', 'research', 'SKILL.md'),
                  'utf-8'
                );
              } catch {
                // Skill file not found
              }

              const dataDir = path.join(projectRoot, 'public', 'data').replace(/\\/g, '/');

              const LANG_NAMES: Record<string, string> = {
                ja: 'Japanese', en: 'English', zh: 'Chinese (Simplified)',
                es: 'Spanish', it: 'Italian', fr: 'French',
              };
              const langName = LANG_NAMES[lang] ?? 'Japanese';

              const parentSlugLine = parentSlug
                ? `\nThis research is a drilldown from parent topic (parentSlug: "${parentSlug}"). Include "parentSlug": "${parentSlug}" in the meta object of the output JSON.\n`
                : '';

              // For update mode, load existing data and build version history
              let updateBlock = '';
              if (isUpdate) {
                try {
                  const existingPath = path.join(dataDir, `${existingSlug}.json`);
                  const existingData = readFileSync(existingPath, 'utf-8');
                  const parsed = JSON.parse(existingData);
                  // Build version entry from current data
                  const currentVersion = {
                    version: (parsed.versions?.length ?? 0) + 1,
                    createdAt: parsed.meta?.createdAt ?? new Date().toISOString(),
                    overview: parsed.overview,
                    keywords: parsed.keywords,
                    webSources: parsed.webSources,
                    academicPapers: parsed.academicPapers,
                    statistics: parsed.statistics,
                    extensions: parsed.extensions,
                  };
                  const versions = [...(parsed.versions ?? []), currentVersion];
                  updateBlock = [
                    '',
                    '=== UPDATE MODE ===',
                    `This is an UPDATE to an existing topic (slug: "${existingSlug}").`,
                    'IMPORTANT INSTRUCTIONS FOR UPDATE MODE:',
                    '1. Read the existing data below carefully',
                    '2. Search for NEW information that has emerged since the last update',
                    '3. Keep all existing content and ADD new findings, sources, and keywords',
                    '4. If any previous facts are now known to be incorrect, add a "corrections" array:',
                    '   [{"target": "what was wrong", "old": "previous claim", "new": "corrected fact", "reason": "why"}]',
                    '5. Use Markdown formatting (tables, bold, headings) in the summary',
                    '6. Generate extensions (chart/table/timeline/map) as appropriate',
                    `7. Include "versions": ${JSON.stringify(versions)} in the output JSON to preserve history`,
                    `8. Keep the same slug "${existingSlug}" in meta`,
                    '',
                    '=== EXISTING DATA ===',
                    existingData,
                    '=== END EXISTING DATA ===',
                    '',
                  ].join('\n');
                } catch {
                  // Existing file not found, treat as new research
                }
              }

              const systemPrompt = [
                'You are a research assistant.',
                `Research the following topic thoroughly: "${topic}"`,
                parentSlugLine,
                updateBlock,
                `CRITICAL LANGUAGE INSTRUCTION: ALL content you generate (overview summary, key findings, significance, keyword terms, ochiai summaries, snippets) MUST be written in ${langName}. The JSON field names stay in English, but all human-readable text values must be in ${langName}.`,
              `Include "lang": "${lang}" in the meta object of the output JSON to record the content language.`,
                '',
                'Follow the skill instructions below to conduct research and write results as JSON files.',
                '',
                'EFFICIENCY: Minimize tool calls while maintaining quality. Run WebSearch calls in parallel where possible. Use Semantic Scholar limit=20 to reduce API calls. Only WebFetch pages when search snippets lack sufficient detail (max 3 fetches). Write the final JSON in a single Write call.',
                '',
                // Race-condition guard (issue #26): when multiple jobs run in
                // parallel the CLI used to read-modify-write index.json and
                // stomp each other. The server now owns index.json updates.
                'CRITICAL: DO NOT read or write public/data/index.json. The server updates index.json automatically once your data file is written. Writing index.json yourself will be detected and overridden, and may corrupt parallel jobs.',
                '',
                skillInstructions,
                '',
                `IMPORTANT: Write output files to ${dataDir}`,
                'IMPORTANT: Only write the single ${slug}.json data file. Do not touch index.json.',
                `REMINDER: Write all content in ${langName}.`,
              ].join('\n');

              writeFileSync(promptFile, systemPrompt, 'utf-8');

              // Use a simple ASCII prompt for -p to avoid Windows shell encoding issues.
              // The actual topic and full instructions are in the system prompt file.
              const child = spawn('claude', [
                '-p', 'Execute the research task described in the system prompt.',
                '--system-prompt-file', promptFile,
                '--allowedTools', 'WebSearch,WebFetch,Read,Write,Skill',
                '--max-turns', '25',
                '--output-format', 'stream-json',
                '--verbose',
              ], {
                cwd: projectRoot,
                shell: true,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: {
                  ...process.env,
                  HOME: process.env.HOME ?? process.env.USERPROFILE ?? '',
                  USERPROFILE: process.env.USERPROFILE ?? '',
                  APPDATA: process.env.APPDATA ?? '',
                  LOCALAPPDATA: process.env.LOCALAPPDATA ?? '',
                },
              });

              let stdoutBuffer = '';

              child.stdout?.on('data', (data: Buffer) => {
                stdoutBuffer += data.toString();
                // Process complete lines
                const lines = stdoutBuffer.split('\n');
                stdoutBuffer = lines.pop() ?? '';
                for (const line of lines) {
                  if (line.trim()) {
                    parseStreamLine(line.trim(), job);
                  }
                }
              });

              let stderrBuffer = '';
              child.stderr?.on('data', (data: Buffer) => {
                const chunk = data.toString();
                stderrBuffer += chunk;
                slog('debug', 'cli.stderr', { jobId, chunk: chunk.slice(0, 1000) });
              });

              child.on('close', (code, signal) => {
                // Process remaining buffer
                if (stdoutBuffer.trim()) {
                  parseStreamLine(stdoutBuffer.trim(), job);
                }
                // If status wasn't set by a result event
                if (job.status === 'running') {
                  if (code === 0) {
                    job.status = 'completed';
                    job.message = `${msg(lang, 'complete')}: ${topic}`;
                    addLog(job, 'done', msg(lang, 'done'));
                  } else {
                    job.status = 'error';
                    const errDetail = stderrBuffer.trim().slice(0, 300);
                    job.message = errDetail || `Process exited with code ${code}`;
                    addLog(job, 'error', job.message);
                  }
                }
                // Validate only the JSON files written by this job
                if (job.status === 'completed' && job.writtenFiles.length > 0) {
                  for (const fp of job.writtenFiles) {
                    const { valid, repaired, error: jsonErr } = validateAndRepairJson(fp);
                    const filename = path.basename(fp);
                    if (repaired) {
                      addLog(job, 'writing', `JSON自動修復: ${filename}`);
                    } else if (!valid) {
                      addLog(job, 'error', `JSONバリデーションエラー (${filename}): ${jsonErr}`);
                    }
                  }
                }
                void finalizeJob(job, { code, signal, reason: 'subprocess close' });
              });

              child.on('error', (err) => {
                job.status = 'error';
                job.message = `Claude CLI failed: ${err.message}`;
                addLog(job, 'error', job.message);
                slog('error', 'cli.spawn_error', { jobId, error: err.message });
                void finalizeJob(job, { reason: 'spawn error' });
              });

              res.statusCode = 202;
              res.end(JSON.stringify({ jobId, topic, status: 'running' }));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Method not allowed' }));
      });
    },
  };
}
