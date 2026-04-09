import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { MarkdownContent } from '@/components/MarkdownContent';
import { MapContainer, TileLayer, Marker as LeafletMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMemo } from 'react';
import type { Extension, ChartSeries } from '@/types/research';

interface ExtensionRendererProps {
  extensions: Record<string, Extension>;
}

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6'];

// Custom marker icon (default Leaflet icons have broken paths in Vite)
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

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

function isMultiSeries(data: number[] | ChartSeries[]): data is ChartSeries[] {
  return data.length > 0 && typeof data[0] === 'object' && 'name' in data[0];
}

function ChartRenderer({ ext }: { ext: Extract<Extension, { type: 'chart' }> }) {
  const multiSeries = isMultiSeries(ext.data);

  // Build data for single or multi series
  const chartData = ext.labels.map((label, i) => {
    const entry: Record<string, string | number> = { name: label };
    if (multiSeries) {
      for (const series of ext.data as ChartSeries[]) {
        entry[series.name] = series.values[i] ?? 0;
      }
    } else {
      entry.value = (ext.data as number[])[i] ?? 0;
    }
    return entry;
  });

  const seriesNames = multiSeries
    ? (ext.data as ChartSeries[]).map(s => s.name)
    : ['value'];

  // Pie chart
  if (ext.chartType === 'pie') {
    const pieData = ext.labels.map((label, i) => ({
      name: label,
      value: multiSeries ? (ext.data as ChartSeries[])[0]?.values[i] ?? 0 : (ext.data as number[])[i] ?? 0,
    }));
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
            {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // Radar chart
  if (ext.chartType === 'radar') {
    return (
      <ResponsiveContainer width="100%" height={350}>
        <RadarChart data={chartData}>
          <PolarGrid stroke="var(--color-border)" />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
          <PolarRadiusAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
          {seriesNames.map((name, i) => (
            <Radar key={name} name={name} dataKey={name}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              fillOpacity={0.2} />
          ))}
          <Tooltip />
          {multiSeries && <Legend />}
        </RadarChart>
      </ResponsiveContainer>
    );
  }

  // Scatter chart
  if (ext.chartType === 'scatter') {
    const scatterData = chartData.map(d => ({ x: d.value ?? d[seriesNames[0]] ?? 0, y: d[seriesNames[1] ?? seriesNames[0]] ?? 0, name: d.name }));
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="x" name={seriesNames[0]} tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
          <YAxis dataKey="y" name={seriesNames[1] ?? seriesNames[0]} tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={scatterData} fill="#6366f1">
            {scatterData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  // Area chart
  if (ext.chartType === 'area') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
          <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
          <Tooltip />
          {seriesNames.map((name, i) => (
            <Area key={name} type="monotone" dataKey={name}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              fillOpacity={0.3} />
          ))}
          {multiSeries && <Legend />}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Stacked bar chart
  if (ext.chartType === 'stackedBar') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
          <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
          <Tooltip />
          <Legend />
          {seriesNames.map((name, i) => (
            <Bar key={name} dataKey={name} stackId="stack"
              fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Line chart
  if (ext.chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
          <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
          <Tooltip />
          {seriesNames.map((name, i) => (
            <Line key={name} type="monotone" dataKey={name}
              stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} />
          ))}
          {multiSeries && <Legend />}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Default: bar chart
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
        <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} />
        <Tooltip />
        {multiSeries ? (
          <>
            <Legend />
            {seriesNames.map((name, i) => (
              <Bar key={name} dataKey={name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </>
        ) : (
          <Bar dataKey="value">
            {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Bar>
        )}
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

function MapRenderer({ ext }: { ext: Extract<Extension, { type: 'map' }> }) {
  // Calculate center from locations
  const avgLat = ext.locations.reduce((s, l) => s + l.lat, 0) / ext.locations.length;
  const avgLng = ext.locations.reduce((s, l) => s + l.lng, 0) / ext.locations.length;

  return (
    <div style={{ height: '400px', width: '100%' }}>
      <MapContainer center={[avgLat, avgLng]} zoom={2} scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {ext.locations.map((loc, i) => (
          <LeafletMarker key={i} position={[loc.lat, loc.lng]} icon={markerIcon}>
            <Popup>
              <strong>{loc.name}</strong>
              {loc.description && <p style={{ margin: '4px 0 0' }}>{loc.description}</p>}
            </Popup>
          </LeafletMarker>
        ))}
      </MapContainer>
    </div>
  );
}

function sanitizeSvg(raw: string): string {
  // Remove script tags, event handlers, and foreign objects
  let svg = raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript\s*:/gi, '');
  // Ensure it's wrapped in an <svg> tag
  if (!svg.trim().startsWith('<svg')) {
    svg = `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  }
  return svg;
}

function DiagramRenderer({ ext }: { ext: Extract<Extension, { type: 'diagram' }> }) {
  const sanitized = useMemo(() => sanitizeSvg(ext.svg), [ext.svg]);
  return (
    <div
      className="overflow-x-auto flex justify-center"
      dangerouslySetInnerHTML={{ __html: sanitized }}
      style={{ maxWidth: '100%' }}
    />
  );
}

export function ExtensionRenderer({ extensions }: ExtensionRendererProps) {

  return (
    <>
      {Object.entries(extensions).map(([key, ext]) => (
        <div key={key} className="theme-bg-card rounded-lg border theme-border p-6">
          <h3 className="text-lg font-semibold theme-text mb-2">{ext.title ?? key}</h3>
          {ext.description && (
            <div className="mb-4">
              <MarkdownContent content={ext.description} className="text-sm theme-text-secondary" />
            </div>
          )}
          {ext.type === 'table' && <TableRenderer ext={ext} />}
          {ext.type === 'chart' && <ChartRenderer ext={ext} />}
          {ext.type === 'timeline' && <TimelineRenderer ext={ext} />}
          {ext.type === 'map' && <MapRenderer ext={ext} />}
          {ext.type === 'diagram' && <DiagramRenderer ext={ext} />}
          {ext.type !== 'table' && ext.type !== 'chart' && ext.type !== 'timeline' && ext.type !== 'map' && ext.type !== 'diagram' && (
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
