import type { Plugin } from 'vite'
import { spawn } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
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
  message?: string;
  logs: LogEntry[];
  lang: string;
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
          res.end(JSON.stringify({ jobId, ...job }));
          return;
        }

        // GET /api/research — list all jobs
        if (req.method === 'GET' && url.match(/^\/api\/research\/?(\?.*)?$/)) {
          const all = Object.fromEntries(jobs);
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

              for (const [, job] of jobs) {
                if (job.status === 'running') {
                  res.statusCode = 409;
                  res.end(JSON.stringify({ error: '別の調査が実行中です', runningTopic: job.topic }));
                  return;
                }
              }

              const job: ResearchJob = {
                topic,
                status: 'running',
                startedAt: new Date().toISOString(),
                logs: [],
                lang,
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
                '',
                'Follow the skill instructions below to conduct research and write results as JSON files.',
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
                '--max-turns', '30',
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
              });

              child.on('error', (err) => {
                job.status = 'error';
                job.message = `Claude CLI failed: ${err.message}`;
                addLog(job, 'error', job.message);
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
