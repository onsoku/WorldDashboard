import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useTranslation } from '@/i18n/useTranslation';
import type { Extension } from '@/types/research';

interface ExtensionRendererProps {
  extensions: Record<string, Extension>;
}

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6'];

function TableRenderer({ ext }: { ext: Extract<Extension, { type: 'table' }> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {ext.headers.map((h, i) => (
              <th key={i} className="text-left p-2 font-semibold theme-text"
                style={{ backgroundColor: 'var(--color-bg-active)', borderBottom: '2px solid var(--color-border)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ext.rows.map((row, i) => (
            <tr key={i} style={i % 2 === 1 ? { backgroundColor: 'var(--color-bg-hover)' } : undefined}>
              {row.map((cell, j) => (
                <td key={j} className="p-2 theme-text-secondary" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartRenderer({ ext }: { ext: Extract<Extension, { type: 'chart' }> }) {
  const data = ext.labels.map((label, i) => ({ name: label, value: ext.data[i] ?? 0 }));

  if (ext.chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (ext.chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
          <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
        <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
        <Tooltip />
        <Bar dataKey="value">
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TimelineRenderer({ ext }: { ext: Extract<Extension, { type: 'timeline' }> }) {
  return (
    <div className="pl-2">
      {ext.events.map((event, i) => (
        <div key={i} className="timeline-item">
          <div className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>{event.date}</div>
          <div className="text-sm font-medium theme-text">{event.title}</div>
          {event.description && <div className="text-xs theme-text-secondary mt-0.5">{event.description}</div>}
        </div>
      ))}
    </div>
  );
}

export function ExtensionRenderer({ extensions }: ExtensionRendererProps) {
  const { t } = useTranslation();

  return (
    <>
      {Object.entries(extensions).map(([key, ext]) => (
        <div key={key} className="theme-bg-card rounded-lg border theme-border p-6">
          <h3 className="text-lg font-semibold theme-text mb-4">{t(`extension.${key}`)}</h3>
          {ext.type === 'table' && <TableRenderer ext={ext} />}
          {ext.type === 'chart' && <ChartRenderer ext={ext} />}
          {ext.type === 'timeline' && <TimelineRenderer ext={ext} />}
          {ext.type !== 'table' && ext.type !== 'chart' && ext.type !== 'timeline' && (
            <pre className="text-xs theme-text-secondary overflow-x-auto p-3 rounded-md"
              style={{ backgroundColor: 'var(--color-bg-active)' }}>
              {JSON.stringify(ext, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </>
  );
}
