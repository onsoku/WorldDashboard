import type { Plugin } from 'vite'
import { spawn } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import path from 'path'

interface LogEntry {
  timestamp: string;
  message: string;
  phase: 'start' | 'web-search' | 'paper-search' | 'synthesis' | 'writing' | 'done' | 'error';
}

interface ResearchJob {
  topic: string;
  status: 'running' | 'completed' | 'error';
  startedAt: string;
  completedAt?: string;
  message?: string;
  logs: LogEntry[];
  lang: string;
  writtenFiles: string[];
  mode?: 'research' | 'translate' | 'update';
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

function toSlug(_topic: string): string {
  // Use a random ID to avoid URL encoding issues with non-ASCII characters
  return 'job-' + Math.random().toString(36).slice(2, 10);
}

function addLog(job: ResearchJob, phase: LogEntry['phase'], message: string) {
  job.logs.push({ timestamp: new Date().toISOString(), phase, message });
}

/**
 * Validate a JSON file written by Claude CLI and attempt to repair common issues.
 * Returns true if the file is valid (or was successfully repaired).
 */
function validateAndRepairJson(filePath: string): { valid: boolean; repaired?: boolean; error?: string } {
  if (!existsSync(filePath)) return { valid: false, error: 'File not found' };
  const raw = readFileSync(filePath, 'utf-8');
  try {
    JSON.parse(raw);
    return { valid: true };
  } catch (e) {
    const errMsg = e instanceof SyntaxError ? e.message : String(e);
    // Attempt repair: fix common issues from LLM-generated JSON
    try {
      let fixed = raw;
      // Remove trailing commas before } or ]
      fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
      // Remove control characters inside strings (except \n \r \t which are valid escaped)
      fixed = fixed.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
      JSON.parse(fixed);
      writeFileSync(filePath, fixed, 'utf-8');
      console.log(`[research-api] Auto-repaired JSON: ${filePath}`);
      return { valid: true, repaired: true };
    } catch {
      console.warn(`[research-api] Invalid JSON in ${filePath}: ${errMsg}`);
      return { valid: false, error: errMsg };
    }
  }
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
              addLog(job, 'writing', msg(L, 'index-write'));
            } else if (filePath.includes('.json')) {
              addLog(job, 'writing', msg(L, 'data-write'));
              job.writtenFiles.push(filePath);
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
        markDone(job);
      } else if (event.subtype === 'error_max_turns') {
        job.status = 'completed';
        job.message = `${msg(L, 'complete')}: ${job.topic}`;
        addLog(job, 'done', msg(L, 'done-max'));
        markDone(job);
      } else {
        job.status = 'error';
        job.message = (event.result as string | undefined)?.slice(0, 500) ?? `Error: ${event.subtype ?? 'unknown'}`;
        addLog(job, 'error', job.message);
        markDone(job);
      }
    }
  } catch {
    // Not valid JSON line, ignore
  }
}

export function researchApiPlugin(): Plugin {
  return {
    name: 'research-api',
    configureServer(server) {
      // Import API endpoint
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (url !== '/api/import' || req.method !== 'POST') return next();

        res.setHeader('Content-Type', 'application/json');
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
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

            // Write topic data
            writeFileSync(path.join(dataDir, `${slug}.json`), JSON.stringify(data, null, 2), 'utf-8');

            // Update index.json
            let index: { topics: { slug: string; topic: string; createdAt: string }[] } = { topics: [] };
            try {
              index = JSON.parse(readFileSync(path.join(dataDir, 'index.json'), 'utf-8'));
            } catch { /* file doesn't exist yet */ }

            const existing = index.topics.findIndex(t => t.slug === slug);
            const entry = { slug, topic, createdAt: data.meta.createdAt ?? new Date().toISOString() };
            if (existing >= 0) {
              index.topics[existing] = entry;
            } else {
              index.topics.push(entry);
            }
            writeFileSync(path.join(dataDir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');

            res.statusCode = 200;
            res.end(JSON.stringify({ slug, topic, status: 'imported' }));
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
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
        const filePath = path.join(dataDir, `${slug}.json`);

        // Validate slug to prevent path traversal
        if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid slug' }));
          return;
        }

        try {
          // Remove the JSON file
          if (existsSync(filePath)) {
            unlinkSync(filePath);
          }

          // Remove from index.json
          const indexPath = path.join(dataDir, 'index.json');
          if (existsSync(indexPath)) {
            const index = JSON.parse(readFileSync(indexPath, 'utf-8'));
            index.topics = (index.topics ?? []).filter((t: { slug: string }) => t.slug !== slug);
            writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
          }

          res.statusCode = 200;
          res.end(JSON.stringify({ slug, status: 'deleted' }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: `Delete failed: ${e instanceof Error ? e.message : String(e)}` }));
        }
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
        const filePath = path.join(dataDir, `${slug}.json`);

        if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
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

        // First check if it's already valid
        try {
          JSON.parse(raw);
          res.statusCode = 200;
          res.end(JSON.stringify({ slug, status: 'already_valid' }));
          return;
        } catch { /* needs repair */ }

        // Attempt repair with multiple strategies
        let fixed = raw;
        try {
          // Strategy 1: Remove trailing commas
          fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
          // Strategy 2: Remove control characters
          fixed = fixed.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
          // Strategy 3: Fix unescaped newlines in strings
          fixed = fixed.replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, '\\n');
          // Strategy 4: Truncate at last valid closing brace if JSON is truncated
          try {
            JSON.parse(fixed);
          } catch (e2) {
            if (e2 instanceof SyntaxError && e2.message.includes('end of JSON input')) {
              // JSON is truncated — find the last complete object
              const lastBrace = fixed.lastIndexOf('}');
              if (lastBrace > 0) {
                // Try progressively truncating to find valid JSON
                for (let i = lastBrace; i >= 0; i--) {
                  if (fixed[i] === '}') {
                    const candidate = fixed.slice(0, i + 1);
                    try {
                      JSON.parse(candidate);
                      fixed = candidate;
                      break;
                    } catch { /* try next */ }
                  }
                }
              }
            }
          }

          JSON.parse(fixed);
          writeFileSync(filePath, fixed, 'utf-8');
          console.log(`[research-api] Repaired JSON: ${filePath}`);
          res.statusCode = 200;
          res.end(JSON.stringify({ slug, status: 'repaired' }));
        } catch {
          res.statusCode = 422;
          res.end(JSON.stringify({ slug, status: 'unrepairable', error: 'Automatic repair failed. Consider deleting this topic.' }));
        }
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
            if (typeof s !== 'string' || s.includes('..') || s.includes('/') || s.includes('\\')) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `Invalid slug: ${s}` }));
              return;
            }
            if (!existsSync(path.join(dataDir, `${s}.json`))) {
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
            const jobId = toSlug('translate') + '-' + Date.now();

            const LANG_NAMES: Record<string, string> = {
              ja: 'Japanese', en: 'English', zh: 'Chinese (Simplified)',
              es: 'Spanish', it: 'Italian', fr: 'French',
            };
            const targetLangName = LANG_NAMES[targetLang] ?? targetLang;

            const job: ResearchJob = {
              topic: `${sourceTopic} → ${targetLangName}`,
              status: 'running',
              startedAt: new Date().toISOString(),
              logs: [],
              lang: targetLang,
              writtenFiles: [],
              mode: 'translate',
            };
            jobs.set(jobId, job);
            addLog(job, 'start', `${msg(targetLang, 'start')}: ${sourceTopic} → ${targetLangName}`);

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
              skillInstructions,
              '',
              `IMPORTANT: Write output files to ${dataDir.replace(/\\/g, '/')}`,
              `Output slug must be "${newSlug}"`,
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
            child.stderr?.on('data', (data: Buffer) => { stderrBuffer += data.toString(); });

            child.on('close', (code) => {
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
              markDone(job);
            });

            child.on('error', (err) => {
              job.status = 'error';
              job.message = `Claude CLI failed: ${err.message}`;
              addLog(job, 'error', job.message);
              markDone(job);
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

        console.log(`[research-api] ${req.method} ${url} (jobs: ${jobs.size})`);

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
          const { writtenFiles, ...jobData } = job;
          // Derive slug from the last written data file (excluding index.json)
          const dataFiles = writtenFiles.filter(f => !f.includes('index.json') && f.endsWith('.json'));
          const lastFile = dataFiles.length > 0 ? path.basename(dataFiles[dataFiles.length - 1], '.json') : undefined;
          res.end(JSON.stringify({ jobId, ...jobData, slug: lastFile }));
          return;
        }

        // GET /api/research — list all jobs
        if (req.method === 'GET' && url.match(/^\/api\/research\/?(\?.*)?$/)) {
          pruneOldJobs();
          const all: Record<string, Omit<ResearchJob, 'writtenFiles'> & { slug?: string }> = {};
          for (const [id, j] of jobs) {
            const { writtenFiles, ...jData } = j;
            const dataFiles = writtenFiles.filter(f => !f.includes('index.json') && f.endsWith('.json'));
            const slug = dataFiles.length > 0 ? path.basename(dataFiles[dataFiles.length - 1], '.json') : undefined;
            all[id] = { ...jData, slug };
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
              const isUpdate = mode === 'update' && existingSlug;

              const jobId = toSlug(topic) + '-' + Date.now();

              const MAX_CONCURRENT = 3;
              const running = [...jobs.values()].filter(j => j.status === 'running');
              if (running.length >= MAX_CONCURRENT) {
                res.statusCode = 409;
                res.end(JSON.stringify({ error: `同時実行数の上限（${MAX_CONCURRENT}）に達しています`, runningTopics: running.map(j => j.topic) }));
                return;
              }

              const job: ResearchJob = {
                topic,
                status: 'running',
                startedAt: new Date().toISOString(),
                logs: [],
                lang,
                writtenFiles: [],
                mode: isUpdate ? 'update' : 'research',
              };
              jobs.set(jobId, job);

              addLog(job, 'start', `${msg(lang, 'start')}: ${topic}`);

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
                skillInstructions,
                '',
                `IMPORTANT: Write output files to ${dataDir}`,
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
                stderrBuffer += data.toString();
              });

              child.on('close', (code) => {
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
                markDone(job);
              });

              child.on('error', (err) => {
                job.status = 'error';
                job.message = `Claude CLI failed: ${err.message}`;
                addLog(job, 'error', job.message);
                markDone(job);
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
