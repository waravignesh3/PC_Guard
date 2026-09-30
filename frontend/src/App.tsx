import { useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from 'react';
import {
  Monitor,
  LayoutDashboard,
  AlertTriangle,
  Settings,
  Bell,
  ChevronRight,
  Search,
  Menu,
  X,
  Activity,
  Cpu,
  HardDrive,
  Shield,
  Users,
  Wrench,
  FileText,
  ChevronLeft,
  Trash2,
  Eye,
  Gauge,
  MemoryStick,
  Server,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Minus,
  Clock,
  Info,
  Palette,
  Database,
  Link,
  HelpCircle,
  Save,
  RotateCcw,
  Loader2,
  HeartPulse,
  Network,
  ArrowUpDown,
  Download,
  Power,
  MessageSquare,
  Sliders,
  ListChecks,
  BarChart3,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import './App.css';

const api = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1') as string;

type Summary = {
  totalComputers: number;
  online: number;
  offline: number;
  warning: number;
  critical: number;
  activeFaults: number;
};

type Computer = {
  id: number;
  agentId: string;
  hostname: string;
  operatingSystem?: string;
  osVersion?: string;
  architecture?: string;
  status: string;
  lastSeen?: string;
  ipAddress?: string;
  registeredAt?: string;
  agentVersion?: string;
};

type Telemetry = {
  id?: number;
  timestamp?: string;
  cpuUsage?: number;
  cpuTemperature?: number;
  ramTotal?: number;
  ramUsed?: number;
  ramAvailable?: number;
  ramUsage?: number;
  storageTotal?: number;
  storageUsed?: number;
  storageFree?: number;
  storageUsage?: number;
  networkStatus?: string;
  networkDownload?: number;
  networkUpload?: number;
  uptime?: number;
};

type Fault = {
  id: number;
  type: string;
  severity: string;
  message: string;
  metric?: string;
  currentValue?: number;
  threshold?: number;
  detectedAt: string;
  resolvedAt?: string | null;
  status: string;
  computer: Computer;
};

type Report = {
  id: number;
  reportType: string;
  title: string;
  description?: string;
  severity?: string;
  createdAt: string;
  status: string;
  computer: Computer;
  content?: string;
};

type NavItem = {
  id: string;
  label: string;
  icon: (props: { size?: number; className?: string }) => ReactNode;
  badge?: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'computers', label: 'Computers', icon: Monitor },
  { id: 'faults', label: 'Active Faults', icon: AlertTriangle },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'activity', label: 'Activity', icon: Activity },
];

const FAULT_FILTERS: { id: 'ACTIVE' | 'RESOLVED' | 'ALL'; label: string }[] = [
  { id: 'ACTIVE', label: 'Active' },
  { id: 'RESOLVED', label: 'Resolved' },
  { id: 'ALL', label: 'All' },
];

type SettingsSectionId = 'general' | 'appearance' | 'notifications' | 'monitoring' | 'dashboard' | 'api' | 'data' | 'about';

type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  group: 'MONITORING' | 'EXPERIENCE' | 'INTEGRATIONS' | 'SYSTEM';
  icon: (props: { size?: number; className?: string }) => ReactNode;
};

const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'general', label: 'General', group: 'MONITORING', icon: Gauge },
  { id: 'appearance', label: 'Appearance', group: 'EXPERIENCE', icon: Palette },
  { id: 'notifications', label: 'Notifications', group: 'EXPERIENCE', icon: MessageSquare },
  { id: 'monitoring', label: 'Monitoring thresholds', group: 'MONITORING', icon: HeartPulse },
  { id: 'dashboard', label: 'Dashboard defaults', group: 'MONITORING', icon: BarChart3 },
  { id: 'api', label: 'API / Connection', group: 'INTEGRATIONS', icon: Link },
  { id: 'data', label: 'Data & inventory', group: 'SYSTEM', icon: Database },
  { id: 'about', label: 'About PC Guard', group: 'SYSTEM', icon: HelpCircle },
];

type ThemeId = 'default' | 'cyan' | 'purple' | 'emerald' | 'crimson' | 'light';

const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'cyan', label: 'Cyan' },
  { id: 'purple', label: 'Purple' },
  { id: 'emerald', label: 'Emerald' },
  { id: 'crimson', label: 'Crimson' },
  { id: 'light', label: 'Light' },
];

const LS_KEY = 'pcguard.settings.v1';

type AppSettings = {
  theme: ThemeId;
  compactDensity: boolean;
  sidebarCollapsed: boolean;
  bellEnabled: boolean;
  soundEnabled: boolean;
  notifyCriticalOnly: boolean;
  defaultNav: string;
  refreshIntervalSec: number;
  autoRefreshEnabled: boolean;
  cpuWarnPct: number;
  ramWarnPct: number;
  diskWarnPct: number;
  apiBaseUrl: string;
  showSparklines: boolean;
  installedAt: string;
};

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'default',
  compactDensity: false,
  sidebarCollapsed: false,
  bellEnabled: true,
  soundEnabled: false,
  notifyCriticalOnly: false,
  defaultNav: 'dashboard',
  refreshIntervalSec: 30,
  autoRefreshEnabled: false,
  cpuWarnPct: 80,
  ramWarnPct: 80,
  diskWarnPct: 90,
  apiBaseUrl: api,
  showSparklines: true,
  installedAt: new Date().toISOString(),
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota errors */
  }
}

async function get<T>(path: string, base?: string): Promise<T> {
  const baseUrl = base ?? api;
  let r: Response;
  try {
    r = await fetch(baseUrl + path, { headers: { Accept: 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      throw new Error(
        `Network failure: cannot reach backend at ${baseUrl} (CORS blocked or backend offline)`
      );
    }
    throw new Error(`Request error: ${msg}`);
  }
  if (!r.ok) {
    let detail = '';
    try {
      detail = await r.text();
      if (detail?.length > 160) detail = detail.slice(0, 160) + '\u2026';
    } catch {}
    const label =
      r.status === 401
        ? 'Unauthorized'
        : r.status === 403
          ? 'Forbidden'
          : r.status === 404
            ? 'Not found'
            : r.status >= 500
              ? 'Server error'
              : 'Request failed';
    throw new Error(`${label} (HTTP ${r.status})${detail ? ': ' + detail : ''}`);
  }
  try {
    return (await r.json()) as T;
  } catch (e) {
    throw new Error(
      `Invalid JSON response (HTTP ${r.status}): ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

async function del(path: string, base?: string): Promise<void> {
  const baseUrl = base ?? api;
  let r: Response;
  try {
    r = await fetch(baseUrl + path, { method: 'DELETE', headers: { Accept: 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Delete failed (network): ${msg}`);
  }
  if (!r.ok) {
    let detail = '';
    try {
      detail = await r.text();
    } catch {}
    throw new Error(`Delete failed (HTTP ${r.status})${detail ? ': ' + detail : ''}`);
  }
}

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : '\u2014';

const formatDateShort = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString() +
      ' ' +
      new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '\u2014';

const formatBytes = (bytes?: number) => {
  if (bytes == null || Number.isNaN(bytes)) return '\u2014';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
};

const formatTemp = (celsius?: number) => {
  if (celsius == null || Number.isNaN(celsius)) return 'Unknown';
  return `${celsius.toFixed(1)} \u00B0C`;
};

const clampUsage = (v?: number) => Math.max(0, Math.min(100, v ?? 0));

const statusClass = (s: string) =>
  ({ ONLINE: 'healthy', WARNING: 'warning', CRITICAL: 'critical', OFFLINE: 'offline' } as Record<string, string>)[s] ||
  'offline';

const statusLabel = (s: string) =>
  ({ ONLINE: 'Online', WARNING: 'Warning', CRITICAL: 'Critical', OFFLINE: 'Offline' } as Record<string, string>)[s] || s;

const severityClass = (sev: string) =>
  ({ WARNING: 'warning', CRITICAL: 'critical', INFO: 'healthy', HIGH: 'critical', MEDIUM: 'warning', LOW: 'healthy' } as Record<string, string>)[sev] ||
  'warning';

const severityLabel = (sev: string) =>
  ({ WARNING: 'Warning', CRITICAL: 'Critical', INFO: 'Info', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' } as Record<string, string>)[sev] || sev;

const num = (v?: number | null, digits = 1) => (v == null || Number.isNaN(v) ? '\u2014' : v.toFixed(digits));

function applyTheme(theme: ThemeId) {
  if (typeof document === 'undefined' || !document.documentElement) return;
  if (theme === 'default') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

type Toast = { id: number; msg: string; type: 'ok' | 'err' };

export default function App() {
  const initial = loadSettings();
  applyTheme(initial.theme);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [computers, setComputers] = useState<Computer[]>([]);
  const [telemetryByComputer, setTelemetryByComputer] = useState<Record<number, Telemetry | null>>({});
  const [faultsByComputer, setFaultsByComputer] = useState<Record<number, Fault[] | null>>({});
  const [reportsByComputer, setReportsByComputer] = useState<Record<number, Report[] | null>>({});
  const [faults, setFaults] = useState<Fault[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sseOk, setSseOk] = useState<null | 'connected'>(null);
  const [backendHealth, setBackendHealth] = useState<'connecting' | 'live' | 'offline' | 'error'>('connecting');
  const isMac = typeof navigator !== 'undefined' ? /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent) : false;
  const kbdLabel = isMac ? '\u2318 K' : 'Ctrl K';
  const [activeNav, setActiveNav] = useState<string>(initial.defaultNav && NAV_ITEMS.some((n) => n.id === initial.defaultNav) ? initial.defaultNav : 'dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initial.sidebarCollapsed);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedComputerId, setSelectedComputerId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedFaultFilter, setSelectedFaultFilter] = useState<'ACTIVE' | 'RESOLVED' | 'ALL'>('ACTIVE');
  const [activeSettings, setActiveSettings] = useState<SettingsSectionId>('general');
  const [settings, setSettings] = useState<AppSettings>(initial);
  const [draftSettings, setDraftSettings] = useState<AppSettings>(initial);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [viewingFaultId, setViewingFaultId] = useState<number | null>(null);
  const [refreshingComputerId, setRefreshingComputerId] = useState<number | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [markAllReadAt, setMarkAllReadAt] = useState<string | null>(null);
  const loadInFlight = useRef(false);
  const pendingDeleteIds = useRef<Set<string>>(new Set());
  const [deletingComputerIds, setDeletingComputerIds] = useState<Set<number>>(() => new Set());
  const refreshingComputerRef = useRef<number | null>(null);
  const addPendingDelete = useCallback((key: string) => {
    pendingDeleteIds.current.add(key);
    const id = Number(key.replace('computer-', ''));
    setDeletingComputerIds((previous) => new Set(previous).add(id));
  }, []);
  const removePendingDelete = useCallback((key: string) => {
    pendingDeleteIds.current.delete(key);
    const id = Number(key.replace('computer-', ''));
    setDeletingComputerIds((previous) => {
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
  }, []);
  const isDeletingComputer = (id: number) => deletingComputerIds.has(id);

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3800);
  }, []);

  useEffect(() => {
    const hash = (typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '') || activeNav;
    if (hash && (NAV_ITEMS.some((n) => n.id === hash) || hash === 'settings')) {
      setActiveNav(hash);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHash = () => {
      const h = window.location.hash.replace('#', '');
      if (!h) return;
      if (NAV_ITEMS.some((n) => n.id === h) || h === 'settings') setActiveNav(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
        setBellOpen(false);
        return;
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false);
        setBellOpen(false);
        setSidebarOpen(false);
        setSelectedComputerId(null);
        setSelectedReportId(null);
        setViewingFaultId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const pushHash = useCallback((id: string) => {
    if (typeof window !== 'undefined' && window.location.hash.replace('#', '') !== id) {
      window.history.replaceState(null, '', `#${id}`);
    }
  }, []);

  const load = useCallback(async (opts?: { showSpinner?: boolean }) => {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    if (opts?.showSpinner) setRefreshing(true);
    try {
      setGlobalError('');
      setBackendHealth((prev) => (prev === 'error' || prev === 'offline' ? 'connecting' : prev));
      const base = settings.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl;
      const [s, c, f, r] = await Promise.all([
        get<Summary>('/dashboard/summary', base),
        get<Computer[]>('/computers', base),
        get<Fault[]>('/faults', base),
        get<Report[]>('/reports', base),
      ]);
      setSummary(s);
      setComputers(c);
      setFaults(f);
      setReports(r);
      // REST data is enough to confirm that the backend is live. SSE is an
      // enhancement, not a prerequisite for a healthy connection.
      setBackendHealth('live');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Backend unavailable';
      setGlobalError(msg);
      setBackendHealth(/Network failure|CORS blocked|Backend unavailable|Request error|HTTP 5/.test(msg) ? 'offline' : 'error');
    } finally {
      loadInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [settings.apiBaseUrl]);

  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!settings.autoRefreshEnabled || settings.refreshIntervalSec <= 0) return;
    const ms = Math.max(5, settings.refreshIntervalSec) * 1000;
    loadTimerRef.current = setInterval(() => void load(), ms) as unknown as ReturnType<typeof setTimeout>;
    return () => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    };
  }, [settings.autoRefreshEnabled, settings.refreshIntervalSec, settings.apiBaseUrl, load]);

  const loadTelemetryFor = useCallback(async (id: number) => {
    const base = settings.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl;
    try {
      const t = await get<Telemetry[]>(`/computers/${id}/telemetry`, base);
      if (t && Array.isArray(t) && t.length > 0) {
        setTelemetryByComputer((prev) => ({ ...prev, [id]: t[0] }));
      } else {
        setTelemetryByComputer((prev) => ({ ...prev, [id]: null }));
      }
    } catch {
      setTelemetryByComputer((prev) => ({ ...prev, [id]: null }));
    }
  }, [settings.apiBaseUrl]);

  const loadComputerFaults = useCallback(async (id: number) => {
    const base = settings.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl;
    try {
      const fl = await get<Fault[]>(`/computers/${id}/faults`, base);
      setFaultsByComputer((prev) => ({ ...prev, [id]: Array.isArray(fl) ? fl : [] }));
    } catch {
      setFaultsByComputer((prev) => ({ ...prev, [id]: [] }));
    }
  }, [settings.apiBaseUrl]);

  const loadComputerReports = useCallback(async (id: number) => {
    const base = settings.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl;
    try {
      const rr = await get<Report[]>(`/computers/${id}/reports`, base);
      setReportsByComputer((prev) => ({ ...prev, [id]: Array.isArray(rr) ? rr : [] }));
    } catch {
      setReportsByComputer((prev) => ({ ...prev, [id]: [] }));
    }
  }, [settings.apiBaseUrl]);

  const sseDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    void load({ showSpinner: false });
    let events: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const base = settings.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl;
    const connect = () => {
      try {
        setBackendHealth((prev) => (prev === 'error' || prev === 'offline' || prev === 'connecting' ? 'connecting' : prev));
        events = new EventSource(`${base}/events`);
        events.onopen = () => {
          setSseOk('connected');
          setBackendHealth('live');
        };
        const throttledLoad = () => {
          if (sseDebounce.current) clearTimeout(sseDebounce.current);
          sseDebounce.current = setTimeout(() => void load(), 700);
        };
        events.addEventListener('telemetry', throttledLoad);
        events.addEventListener('heartbeat', throttledLoad);
        events.addEventListener('fault', throttledLoad);
        events.onerror = () => {
          setSseOk(null);
          if (events) {
            events.close();
            events = null;
          }
          setBackendHealth(globalError ? 'error' : 'offline');
          retryTimer = setTimeout(connect, 5000);
        };
      } catch {
        setSseOk(null);
        setBackendHealth(globalError ? 'error' : 'offline');
        retryTimer = setTimeout(connect, 5000);
      }
    };
    connect();
    return () => {
      if (sseDebounce.current) clearTimeout(sseDebounce.current);
      if (retryTimer) clearTimeout(retryTimer);
      if (events) events.close();
    };
  }, [load, settings.apiBaseUrl]);

  useEffect(() => {
    for (const c of computers) {
      if (telemetryByComputer[c.id] === undefined) void loadTelemetryFor(c.id);
    }
  }, [computers, loadTelemetryFor, telemetryByComputer]);

  useEffect(() => {
    if (selectedComputerId == null) return;
    if (faultsByComputer[selectedComputerId] === undefined) void loadComputerFaults(selectedComputerId);
    if (reportsByComputer[selectedComputerId] === undefined) void loadComputerReports(selectedComputerId);
  }, [selectedComputerId, loadComputerFaults, loadComputerReports, faultsByComputer, reportsByComputer]);

  const activeFaults = useMemo(() => faults.filter((f) => f.status === 'ACTIVE'), [faults]);
  const resolvedFaults = useMemo(() => faults.filter((f) => f.status === 'RESOLVED' || f.resolvedAt), [faults]);
  const knownCriticalFaultIds = useRef<Set<number> | null>(null);

  useEffect(() => {
    const current = new Set(activeFaults.filter((fault) => fault.severity === 'CRITICAL' || fault.severity === 'HIGH').map((fault) => fault.id));
    if (knownCriticalFaultIds.current === null) {
      knownCriticalFaultIds.current = current;
      return;
    }
    const hasNewCriticalFault = [...current].some((id) => !knownCriticalFaultIds.current?.has(id));
    knownCriticalFaultIds.current = current;
    if (!settings.soundEnabled || !hasNewCriticalFault || typeof AudioContext === 'undefined') return;
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.06, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);
      oscillator.addEventListener('ended', () => void context.close());
    } catch {
      // Some browsers require a prior user gesture before they allow alert audio.
    }
  }, [activeFaults, settings.soundEnabled]);

  const displayedFaults = useMemo(() => {
    if (selectedFaultFilter === 'ACTIVE') return activeFaults;
    if (selectedFaultFilter === 'RESOLVED') return resolvedFaults;
    return faults;
  }, [faults, activeFaults, resolvedFaults, selectedFaultFilter]);

  const filteredComputers = useMemo(() => {
    if (!searchText.trim()) return computers;
    const q = searchText.trim().toLowerCase();
    return computers.filter(
      (c) =>
        c.hostname.toLowerCase().includes(q) ||
        c.agentId.toLowerCase().includes(q) ||
        (c.operatingSystem ?? '').toLowerCase().includes(q) ||
        (c.ipAddress ?? '').toLowerCase().includes(q)
    );
  }, [computers, searchText]);

  const deleteComputer = useCallback(
    async (id: number, hostname: string) => {
      const key = `computer-${id}`;
      if (pendingDeleteIds.current.has(key)) return;
      addPendingDelete(key);
      if (!window.confirm(`Remove ${hostname} from monitoring? All associated telemetry, heartbeats, faults and reports will be deleted.`)) {
        removePendingDelete(key);
        return;
      }
      try {
        const base = settings.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl;
        await del(`/computers/${id}`, base);
        showToast(`Removed ${hostname}`);
        setComputers((prev) => prev.filter((c) => c.id !== id));
        setFaults((prev) => prev.filter((f) => f.computer?.id !== id));
        setReports((prev) => prev.filter((r) => r.computer?.id !== id));
        setTelemetryByComputer((prev) => { const n = { ...prev }; delete n[id]; return n; });
        setFaultsByComputer((prev) => { const n = { ...prev }; delete n[id]; return n; });
        setReportsByComputer((prev) => { const n = { ...prev }; delete n[id]; return n; });
        if (selectedComputerId === id) setSelectedComputerId(null);
        setSummary((s) => {
          if (!s) return s;
          return { ...s, totalComputers: Math.max(0, s.totalComputers - 1) };
        });
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Delete failed', 'err');
      } finally {
        removePendingDelete(key);
      }
    },
    [selectedComputerId, showToast, settings.apiBaseUrl, addPendingDelete, removePendingDelete]
  );

  const refreshComputerData = useCallback(async (id: number, hostname: string) => {
    if (refreshingComputerRef.current === id) return;
    refreshingComputerRef.current = id;
    setRefreshingComputerId(id);
    try {
      const base = settings.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl;
      const [computer] = await Promise.all([
        get<Computer>(`/computers/${id}`, base),
        loadTelemetryFor(id),
        loadComputerFaults(id),
        loadComputerReports(id),
      ]);
      setComputers((previous) => previous.map((item) => (item.id === id ? computer : item)));
      showToast(`Refreshed ${hostname}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : `Unable to refresh ${hostname}`, 'err');
    } finally {
      refreshingComputerRef.current = null;
      setRefreshingComputerId(null);
    }
  }, [refreshingComputerId, settings.apiBaseUrl, loadTelemetryFor, loadComputerFaults, loadComputerReports, showToast]);

  const switchNav = useCallback(
    (id: string) => {
      setActiveNav(id);
      pushHash(id);
      setSidebarOpen(false);
      setPaletteOpen(false);
      setBellOpen(false);
      setSelectedComputerId(null);
      setSelectedReportId(null);
      setViewingFaultId(null);
    },
    [pushHash]
  );

  const selectedComputer = useMemo(
    () => (selectedComputerId != null ? computers.find((c) => c.id === selectedComputerId) ?? null : null),
    [computers, selectedComputerId]
  );
  const selectedTelemetry = selectedComputerId != null ? telemetryByComputer[selectedComputerId] ?? null : null;
  const selectedComputerFaults = selectedComputerId != null ? faultsByComputer[selectedComputerId] ?? null : null;
  const selectedComputerReports = selectedComputerId != null ? reportsByComputer[selectedComputerId] ?? null : null;

  const selectedReport = useMemo(
    () => (selectedReportId != null ? reports.find((r) => r.id === selectedReportId) ?? null : null),
    [reports, selectedReportId]
  );
  const viewingFault = useMemo(
    () => (viewingFaultId != null ? faults.find((f) => f.id === viewingFaultId) ?? null : null),
    [faults, viewingFaultId]
  );

  const notificationItems = useMemo(() => {
    const base = new Date(markAllReadAt ?? 0);
    const items: { id: string; kind: 'fault' | 'report'; time: string; host: string; title: string; severity: string; unread: boolean }[] = [];
    for (const f of activeFaults) {
      items.push({
        id: `f${f.id}`,
        kind: 'fault',
        time: f.detectedAt,
        host: f.computer?.hostname ?? 'Unknown',
        title: f.message,
        severity: f.severity,
        unread: new Date(f.detectedAt) > base,
      });
    }
    for (const r of reports.slice(0, 50)) {
      items.push({
        id: `r${r.id}`,
        kind: 'report',
        time: r.createdAt,
        host: r.computer?.hostname ?? 'Unknown',
        title: r.title,
        severity: r.severity ?? 'INFO',
        unread: new Date(r.createdAt) > base,
      });
    }
    return items
      .filter((it) => !settings.notifyCriticalOnly || it.severity === 'CRITICAL' || it.severity === 'HIGH')
      .sort((a, b) => +new Date(b.time) - +new Date(a.time))
      .slice(0, 20);
  }, [activeFaults, reports, markAllReadAt, settings.notifyCriticalOnly]);

  const unreadCount = notificationItems.filter((n) => n.unread).length;

  const pieData = useMemo(() => {
    if (!summary) return [];
    const out: { name: string; value: number; color: string }[] = [];
    if (summary.online > 0) out.push({ name: 'Online', value: summary.online, color: '#32d6a0' });
    if (summary.warning > 0) out.push({ name: 'Warning', value: summary.warning, color: '#f4ba4b' });
    if (summary.critical > 0) out.push({ name: 'Critical', value: summary.critical, color: '#fb6873' });
    if (summary.offline > 0) out.push({ name: 'Offline', value: summary.offline, color: '#77849c' });
    if (out.length === 0) out.push({ name: 'None', value: 1, color: '#2a4670' });
    return out;
  }, [summary]);

  // Settings draft dirty-flag watcher
  useEffect(() => {
    const dirty = JSON.stringify(draftSettings) !== JSON.stringify(settings);
    setSettingsDirty(dirty);
  }, [draftSettings, settings]);

  const setSidebarCollapsedPersist = (v: boolean) => {
    setSidebarCollapsed(v);
    setSettings((s) => {
      const next = { ...s, sidebarCollapsed: v };
      saveSettings(next);
      setDraftSettings(next);
      return next;
    });
  };

  const applyDraft = () => {
    const next = { ...draftSettings };
    saveSettings(next);
    setSettings(next);
    if (next.theme !== settings.theme) applyTheme(next.theme);
    if (next.sidebarCollapsed !== sidebarCollapsed) setSidebarCollapsed(next.sidebarCollapsed);
    if (!next.bellEnabled) setBellOpen(false);
    setSettingsDirty(false);
    showToast('Settings saved');
  };

  const resetDraft = () => {
    setDraftSettings(settings);
    showToast('Draft reset to last saved');
  };

  const restoreDefaults = () => {
    if (!window.confirm('Reset all settings to defaults? Your saved preferences will be cleared.')) return;
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1') as string;
    const next: AppSettings = { ...DEFAULT_SETTINGS, apiBaseUrl: base, installedAt: settings.installedAt };
    saveSettings(next);
    setSettings(next);
    setDraftSettings(next);
    applyTheme(next.theme);
    setSidebarCollapsed(next.sidebarCollapsed);
    showToast('All settings restored to defaults');
  };

  const testConnection = async () => {
    const base = draftSettings.apiBaseUrl.trim().replace(/\/$/, '');
    if (!base) {
      showToast('Enter a backend API base URL first.', 'err');
      return;
    }
    setTestingConnection(true);
    setBackendHealth('connecting');
    try {
      await get<{ status: string }>('/health', base);
      setGlobalError('');
      setBackendHealth('live');
      showToast('Backend connection verified');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reach backend';
      setBackendHealth('offline');
      showToast(message, 'err');
    } finally {
      setTestingConnection(false);
    }
  };

  const downloadReport = useCallback((report: Report) => {
    const blob = new Blob([JSON.stringify({ report }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `report-${report.id}-${report.computer?.hostname ?? 'machine'}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Downloaded report #${report.id}`);
  }, [showToast]);

  const paletteItems = useMemo(() => {
    type PI = { id: string; label: string; icon: (p: { size?: number }) => ReactNode; action: () => void };
    const items: PI[] = [
      { id: 'nav-dashboard', label: 'Open Dashboard', icon: LayoutDashboard, action: () => switchNav('dashboard') },
      { id: 'nav-computers', label: 'Computer inventory', icon: Monitor, action: () => switchNav('computers') },
      { id: 'nav-faults', label: 'Active faults', icon: AlertTriangle, action: () => switchNav('faults') },
      { id: 'nav-reports', label: 'System reports', icon: FileText, action: () => switchNav('reports') },
      { id: 'nav-activity', label: 'Recent events', icon: Activity, action: () => switchNav('activity') },
      { id: 'nav-settings', label: 'Global settings', icon: Settings, action: () => switchNav('settings') },
      { id: 'sep-1', label: '\u2014 Actions \u2014', icon: ListChecks, action: () => {} },
      { id: 'act-refresh', label: 'Refresh monitoring data', icon: Activity, action: () => void load({ showSpinner: true }) },
      { id: 'act-collapse', label: sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar', icon: Sliders, action: () => setSidebarCollapsedPersist(!sidebarCollapsed) },
    ];
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      const matches = computers.filter((c) => c.hostname.toLowerCase().includes(q)).slice(0, 5);
      matches.forEach((c) => {
        items.push({
          id: `pc-${c.id}`,
          label: `Open computer: ${c.hostname}`,
          icon: Monitor,
          action: () => { setActiveNav('computers'); setSelectedComputerId(c.id); setPaletteOpen(false); },
        });
      });
    }
    return items;
  }, [switchNav, sidebarCollapsed, load, searchText, computers]);

  const pieTotal = useMemo(() => pieData.reduce((a, b) => a + b.value, 0) || 1, [pieData]);

  if (loading) {
    return (
      <div className={`app ${settings.compactDensity ? 'compact' : ''}`}>
        <main>
          <header>
            <div className="head-actions">
              <button type="button" className="hamb" onClick={() => setSidebarOpen((v) => !v)} aria-label="Open navigation menu">
                <Menu size={20} />
              </button>
            </div>
            <div />
          </header>
          <div className="content">
            <div className="heading">
              <div>
                <p>PC GUARD</p>
                <h1>Loading<em>\u2026</em></h1>
                <span>Fetching monitoring data from {settings.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 12 }}>
                <Loader2 size={16} className="spin" /> Initializing
              </div>
            </div>
            <section className="card metrics" style={{ opacity: 0.6 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="metric">
                  <div className="metric-icon blue"><Gauge size={18} /></div>
                  <span>\u2026</span>
                  <strong style={{ opacity: 0.4 }}>--</strong>
                  <small><em>loading</em></small>
                </div>
              ))}
            </section>
          </div>
        </main>
        {toasts.length > 0 && (
          <div className="toast-stack">
            {toasts.map((t) => (
              <div key={t.id} className="toast" style={{ borderLeftColor: t.type === 'ok' ? '#32d6a0' : '#fb6873' }}>
                {t.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} style={{ color: '#fb6873' }} />}
                <span>{t.msg}</span>
                <button onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}><X size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const compactClass = settings.compactDensity ? 'compact' : '';

  return (
    <div
      className={`app ${compactClass}`}
      onClick={() => { setSidebarOpen(false); setBellOpen(false); setPaletteOpen(false); }}
    >
      {sidebarOpen && <div className="veil" />}
      <aside
        className={`${sidebarCollapsed ? 'collapsed' : ''} ${sidebarOpen ? 'open' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="brand">
          <div className="logo">
            <Shield size={20} />
          </div>
          {!sidebarCollapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>PC Guard</b>
              <small>REAL-TIME MONITORING</small>
            </div>
          )}
          <button className="close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        <nav>
          {NAV_ITEMS.map((it) => {
            const Icon = it.icon;
            let badge: string | undefined;
            if (it.id === 'faults') badge = String(activeFaults.length || 0);
            else if (it.id === 'computers') badge = String(computers.length || 0);
            else if (it.id === 'reports' && reports.length > 0) badge = String(reports.length);
            const isActive = activeNav === it.id;
            return (
              <button
                key={it.id}
                className={isActive ? 'active' : ''}
                onClick={() => switchNav(it.id)}
                title={it.label}
              >
                <Icon size={17} />
                {!sidebarCollapsed && <span>{it.label}</span>}
                {!sidebarCollapsed && badge && <b>{badge}</b>}
              </button>
            );
          })}
        </nav>

        <div className="sidefoot">
          <div className="system">
            <i className={backendHealth === 'live' ? 'live' : backendHealth === 'connecting' ? 'connecting' : backendHealth === 'offline' ? 'offline' : 'error'} />
            <div className="sys-info">
              <small>
                {backendHealth === 'live' ? 'BACKEND LIVE' :
                 backendHealth === 'connecting' ? 'CONNECTING' :
                 backendHealth === 'offline' ? 'BACKEND OFFLINE' : 'BACKEND ERROR'}
              </small>
              <b>
                {backendHealth === 'live' ? (sseOk === 'connected' ? 'Events streaming' : 'REST connection verified') :
                 backendHealth === 'connecting' ? 'Establishing link\u2026' :
                 backendHealth === 'offline' ? 'Polling fallback' : 'Configuration error'}
              </b>
            </div>
          </div>
          <div className="profile">
            <div className="profile-avatar" aria-hidden="true">
              <Users size={15} />
            </div>
            {!sidebarCollapsed && (
              <div className="profile-info">
                <b>Administrator</b>
                <small>Local console</small>
              </div>
            )}
            {!sidebarCollapsed && (
              <button
                type="button"
                className="profile-settings-btn"
                title="Open Settings"
                aria-label="Open Settings"
                onClick={() => switchNav('settings')}
              >
                <Settings size={15} />
              </button>
            )}
          </div>
          <button type="button" className="collapse" onClick={() => setSidebarCollapsedPersist(!sidebarCollapsed)} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      </aside>

      <main>
        <header onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button type="button" className="hamb" onClick={(e) => { e.stopPropagation(); setSidebarOpen((v) => !v); }} aria-label="Open navigation menu">
              <Menu size={20} />
            </button>
            <button
              type="button"
              className="search"
              onClick={(e) => { e.stopPropagation(); setPaletteOpen((v) => !v); setBellOpen(false); }}
              aria-haspopup="dialog"
              aria-expanded={paletteOpen}
              style={{ cursor: 'text' }}
            >
              <Search size={15} />
              {searchText.trim() ? (
                <span className="search-value">{searchText.trim()}</span>
              ) : (
                <span className="search-placeholder">
                  {activeNav === 'computers' ? 'Search computers, actions, pages\u2026' : 'Search pages and actions\u2026'}
                </span>
              )}
              {activeNav === 'computers' && (
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder=""
                  style={{ flex: 1, color: 'var(--text)' }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Filter computers"
                />
              )}
              <kbd>{kbdLabel}</kbd>
            </button>
          </div>
          <div className="head-actions">
            <button onClick={() => void load({ showSpinner: true })} title="Refresh monitoring data" disabled={refreshing}>
              <Activity size={17} className={refreshing ? 'spin' : ''} />
              <span style={{ fontSize: 11 }}>{refreshing ? 'Refreshing' : 'Refresh'}</span>
            </button>
            <div className="bellwrap">
              <button
                title="Notifications"
                onClick={(e) => { e.stopPropagation(); setBellOpen((v) => !v); setPaletteOpen(false); }}
                aria-haspopup="menu"
                aria-expanded={bellOpen}
                aria-label="Notifications"
                disabled={!settings.bellEnabled}
              >
                <Bell size={17} />
                {settings.bellEnabled && unreadCount > 0 && <b>{unreadCount}</b>}
              </button>
              {bellOpen && (
                <div className="belltray" onClick={(e) => e.stopPropagation()}>
                  <div className="trayhead">
                    <div>
                      <b>Notifications</b>
                      <small>{notificationItems.length} recent items</small>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => { setMarkAllReadAt(new Date().toISOString()); showToast('Marked all as read'); }}
                        style={{ fontSize: 10 }}
                        className="ghost"
                      >
                        <CheckCircle2 size={12} /> Mark read
                      </button>
                      <button onClick={() => switchNav('activity')} style={{ fontSize: 10 }} className="ghost">
                        <Activity size={12} /> View all
                      </button>
                    </div>
                  </div>
                  <div className="traylist">
                    {notificationItems.length === 0 ? (
                      <div className="trayempty">
                        <CheckCircle2 size={18} style={{ color: '#32d6a0' }} /> <span>No new items</span>
                      </div>
                    ) : (
                      notificationItems.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => {
                            if (n.kind === 'fault') {
                              switchNav('faults');
                            } else {
                              switchNav('reports');
                            }
                            setBellOpen(false);
                          }}
                          className={`trayitem ${n.unread ? 'unread' : ''}`}
                        >
                          <div className={`ni ${n.severity === 'CRITICAL' || n.severity === 'HIGH' ? 'n0' : n.severity === 'WARNING' || n.severity === 'MEDIUM' ? 'n2' : 'n3'}`}>
                            {n.kind === 'fault' ? <AlertTriangle size={14} /> : <FileText size={14} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700 }}>
                              {n.host} {n.unread && <span style={{ color: 'var(--primary)', marginLeft: 6 }}>NEW</span>}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{n.title}</div>
                            <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>{formatDateShort(n.time)}</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="health" title={`Backend: ${backendHealth === 'live' ? 'Live SSE feed' : backendHealth === 'connecting' ? 'Connecting to backend' : backendHealth === 'offline' ? 'Backend offline - polling only' : 'Configuration or connection error'}`}>
              <i className={backendHealth === 'live' ? 'live' : backendHealth === 'connecting' ? 'connecting' : backendHealth === 'offline' ? 'offline' : 'error'} />
              {backendHealth === 'live' ? (sseOk === 'connected' ? 'Live feed' : 'Backend live') :
               backendHealth === 'connecting' ? 'Connecting' :
               backendHealth === 'offline' ? (globalError ? 'Offline' : 'Polling') :
               'Check settings'}
            </div>
          </div>
        </header>

        <div className="content">
          {globalError && (
            <div
              className="card"
              style={{
                padding: 16,
                marginBottom: 18,
                borderLeft: '3px solid #fb6873',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <XCircle size={20} style={{ color: '#fb6873', flex: 'none', marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Backend unavailable</div>
                <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>{globalError}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
                  API base: <code style={{ background: 'var(--border)', padding: '2px 6px', borderRadius: 4 }}>{settings.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl}</code>
                  {' '}&middot; Tip: Change API base URL in Settings / API Connection if needed.
                </div>
              </div>
              <button
                className="primary"
                onClick={() => { setLoading(true); void load({ showSpinner: true }); }}
                style={{ height: 34, padding: '0 12px' }}
                disabled={refreshing}
              >
                {refreshing ? <Loader2 size={14} className="spin" /> : <Activity size={14} />}
                {refreshing ? 'Retrying' : ' Retry'}
              </button>
            </div>
          )}

          {paletteOpen && (
            <div className="palette backdrop" onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 90, left: 50, zIndex: 100 }}>
              <div>
                <Search size={14} style={{ color: 'var(--muted)' }} />
                <input
                  autoFocus
                  type="text"
                  placeholder="Type to search computers, pages, actions\u2026"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <button type="button" onClick={() => setPaletteOpen(false)} style={{ width: 'auto', padding: '4px 8px' }}><X size={14} /></button>
              </div>
              <p>NAVIGATION</p>
              {paletteItems.map((pi, idx) => {
                const Icon = pi.icon;
                if (pi.id.startsWith('sep-')) {
                  return (
                    <div key={pi.id} style={{ color: 'var(--muted)', letterSpacing: 1, margin: '14px 10px 5px', fontSize: 9 }}>
                      {pi.label}
                    </div>
                  );
                }
                const isFirstNav = idx === 0;
                if (isFirstNav || pi.id === 'sep-1') return null;
                return (
                  <button type="button" key={pi.id} onClick={() => { pi.action(); setPaletteOpen(false); }}>
                    <Icon size={14} /> {pi.label}
                  </button>
                );
              })}
              <p>ACTIONS</p>
              {paletteItems.filter((_, idx) => idx >= 6).map((pi) => {
                if (pi.id.startsWith('sep-')) return null;
                const Icon = pi.icon;
                return (
                  <button type="button" key={pi.id} onClick={() => { pi.action(); setPaletteOpen(false); }}>
                    <Icon size={14} /> {pi.label}
                  </button>
                );
              })}
            </div>
          )}

          <div key={activeNav} className="page-enter">
            <div className="heading">
              <div>
                <p>
                {activeNav === 'dashboard' && 'OVERVIEW'}
                {activeNav === 'computers' && 'INVENTORY'}
                {activeNav === 'faults' && 'FAULT MANAGEMENT'}
                {activeNav === 'reports' && 'REPORTS'}
                {activeNav === 'activity' && 'ACTIVITY LOG'}
                {activeNav === 'settings' && 'SYSTEM'}
              </p>
              <h1>
                {activeNav === 'dashboard' && 'Lab '}
                {activeNav === 'computers' && 'Managed '}
                {activeNav === 'faults' && (selectedFaultFilter === 'ACTIVE' ? 'Active ' : selectedFaultFilter === 'RESOLVED' ? 'Resolved ' : 'All ')}
                {activeNav === 'reports' && 'System '}
                {activeNav === 'activity' && 'Recent '}
                {activeNav === 'settings' && 'Global '}
                <em>
                  {activeNav === 'dashboard' && 'Health'}
                  {activeNav === 'computers' && 'Computers'}
                  {activeNav === 'faults' && 'Faults'}
                  {activeNav === 'reports' && 'Reports'}
                  {activeNav === 'activity' && 'Events'}
                  {activeNav === 'settings' && 'Settings'}
                </em>
              </h1>
              <span>
                {computers.length === 0
                  ? 'No PC Guard agents connected. Start the PC Guard Java Agent on a machine to register it.'
                  : `${computers.length} agent${computers.length === 1 ? '' : 's'} reporting live telemetry from ${computers.filter((c) => c.status === 'ONLINE').length} online system${computers.filter((c) => c.status === 'ONLINE').length === 1 ? '' : 's'}.`}
                {settings.autoRefreshEnabled && (
                  <> {' '}&middot; Auto refresh every {settings.refreshIntervalSec}s</>
                )}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {activeNav === 'faults' && (
                <div className="segment">
                  {FAULT_FILTERS.map((f) => (
                    <button key={f.id} className={selectedFaultFilter === f.id ? 'selected' : ''} onClick={() => setSelectedFaultFilter(f.id)}>
                      {f.label}
                      {f.id === 'ACTIVE' && activeFaults.length > 0 && <b style={{ marginLeft: 6 }}>{activeFaults.length}</b>}
                      {f.id === 'RESOLVED' && resolvedFaults.length > 0 && <b style={{ marginLeft: 6 }}>{resolvedFaults.length}</b>}
                      {f.id === 'ALL' && faults.length > 0 && <b style={{ marginLeft: 6 }}>{faults.length}</b>}
                    </button>
                  ))}
                </div>
              )}
              {activeNav === 'dashboard' && (
                <button className="primary" onClick={() => void load({ showSpinner: true })} disabled={refreshing}>
                  {refreshing ? <Loader2 size={14} className="spin" /> : <Activity size={14} />}
                  {' '}{refreshing ? 'Refreshing' : 'Refresh monitoring'}
                </button>
              )}
              {(activeNav === 'faults' || activeNav === 'reports' || activeNav === 'activity') && (
                <button className="primary" onClick={() => void load({ showSpinner: true })} disabled={refreshing}>
                  {refreshing ? <Loader2 size={14} className="spin" /> : <Activity size={14} />}
                  {' '}Refresh
                </button>
              )}
            </div>
          </div>

          {activeNav === 'dashboard' && (
            <>
              <section className={`metrics card metrics ${settings.showSparklines ? '' : 'no-sparks'}`}>
                <div className="metric">
                  <div className="metric-icon blue"><Monitor size={18} /></div>
                  <span>TOTAL COMPUTERS</span>
                  <strong>{summary?.totalComputers ?? 0}</strong>
                  <small><em>registered agents</em></small>
                  {settings.showSparklines && (
                    <div className="spark">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <i key={i} style={{ height: `${18 + ((i * 13) % 13)}px` }} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="metric">
                  <div className="metric-icon green"><CheckCircle2 size={18} /></div>
                  <span>ONLINE</span>
                  <strong>{summary?.online ?? 0}</strong>
                  <small className="up">&uarr; healthy</small>
                  {settings.showSparklines && (
                    <div className="spark">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <i key={i} style={{ height: `${22 + ((i * 17) % 10)}px` }} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="metric">
                  <div className="metric-icon amber"><AlertCircle size={18} /></div>
                  <span>WARNING</span>
                  <strong>{summary?.warning ?? 0}</strong>
                  <small>{summary && summary.warning > 0 ? 'needs attention' : <em>no warnings</em>}</small>
                  {settings.showSparklines && (
                    <div className="spark">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <i key={i} style={{ height: `${6 + ((i * 19) % 18)}px` }} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="metric">
                  <div className="metric-icon red"><XCircle size={18} /></div>
                  <span>CRITICAL</span>
                  <strong>{summary?.critical ?? 0}</strong>
                  <small>{summary && summary.critical > 0 ? 'immediate action' : <em>all stable</em>}</small>
                  {settings.showSparklines && (
                    <div className="spark">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <i key={i} style={{ height: `${3 + ((i * 23) % 15)}px` }} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="metric">
                  <div className="metric-icon purple"><Gauge size={18} /></div>
                  <span>ACTIVE FAULTS</span>
                  <strong>{summary?.activeFaults ?? 0}</strong>
                  <small>{summary && summary.activeFaults === 0 ? <em>all clear</em> : 'awaiting review'}</small>
                  {settings.showSparklines && (
                    <div className="spark">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <i key={i} style={{ height: `${9 + ((i * 29) % 22)}px` }} />
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <div className="twocol">
                <section className="card healthcard">
                  <div className="sectionhead">
                    <div>
                      <h2>Fleet health</h2>
                      <p>AGGREGATE STATUS</p>
                    </div>
                    <button onClick={() => switchNav('computers')}>
                      View inventory <ChevronRight size={13} />
                    </button>
                  </div>
                  <div className="healthbody">
                    <div className="donut">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={62}
                            outerRadius={82}
                            stroke="none"
                            paddingAngle={2}
                          >
                            {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div>
                        <b>{summary?.totalComputers ?? 0}</b>
                        <small>systems monitored</small>
                        <small style={{ marginTop: 4 }}>Total {pieTotal}</small>
                      </div>
                    </div>
                    <div className="legend">
                      <span><i style={{ background: '#32d6a0' }} /> Online <b>{summary?.online ?? 0}</b></span>
                      <span><i style={{ background: '#f4ba4b' }} /> Warning <b>{summary?.warning ?? 0}</b></span>
                      <span><i style={{ background: '#fb6873' }} /> Critical <b>{summary?.critical ?? 0}</b></span>
                      <span><i style={{ background: '#77849c' }} /> Offline <b>{summary?.offline ?? 0}</b></span>
                      <span style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                        <i style={{ background: 'var(--primary)' }} /> Active faults <b>{summary?.activeFaults ?? 0}</b>
                      </span>
                    </div>
                  </div>
                </section>

                <section className="card activity">
                  <div className="sectionhead">
                    <div>
                      <h2>Recent activity</h2>
                      <p>LATEST EVENTS</p>
                    </div>
                    <button onClick={() => switchNav('activity')}>
                      All events <ChevronRight size={13} />
                    </button>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {activeFaults.length === 0 && reports.length === 0 ? (
                      <div style={{ padding: '24px 8px', color: 'var(--muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <CheckCircle2 size={18} style={{ color: '#32d6a0' }} />
                        No recent activity. All systems nominal.
                      </div>
                    ) : (
                      [...activeFaults, ...reports.slice(0, 5)]
                        .sort((a, b) => +new Date((a as Fault).detectedAt ?? (a as Report).createdAt) - +new Date((b as Fault).detectedAt ?? (b as Report).createdAt))
                        .reverse()
                        .slice(0, 5)
                        .map((e) => {
                          const isFault = 'severity' in e && 'metric' in e;
                          const fe = e as Fault;
                          const re = e as Report;
                          const time = isFault ? fe.detectedAt : re.createdAt;
                          const host = fe.computer?.hostname ?? re.computer?.hostname ?? '\u2014';
                          const sev = isFault ? fe.severity : re.severity ?? 'INFO';
                          const cls = isFault ? (sev === 'CRITICAL' ? 'e0' : 'e2') : 'e1';
                          const msg = isFault ? fe.message : re.title;
                          const Icon = isFault ? AlertTriangle : FileText;
                          return (
                            <div
                              className="event"
                              key={`${isFault ? 'f' : 'r'}-${e.id}`}
                              style={{ cursor: 'pointer' }}
                              onClick={() => { if (isFault) { setViewingFaultId(fe.id); } else { setSelectedReportId(re.id); } }}
                              title="View details"
                            >
                              <div className={`e ${cls}`}><Icon size={15} /></div>
                              <span>
                                <b>{host}</b>
                                <small>{msg}</small>
                              </span>
                              <time>{formatDateShort(time)}</time>
                            </div>
                          );
                        })
                    )}
                  </div>
                </section>
              </div>

              <section className="card computersec">
                <div className="sectionhead">
                  <div>
                    <h2>Managed computers</h2>
                    <p>REGISTERED AGENTS</p>
                  </div>
                  <button onClick={() => switchNav('computers')}>
                    Full inventory <ChevronRight size={13} />
                  </button>
                </div>
                {computers.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                    <Server size={32} style={{ marginBottom: 10, opacity: 0.5 }} />
                    <div><b style={{ color: 'var(--text)' }}>No PC Guard agents connected</b></div>
                    <div style={{ marginTop: 6 }}>Start the PC Guard Java Agent on a machine to register it and begin collecting telemetry.</div>
                  </div>
                ) : (
                  <div className="mini-grid">
                    {computers.slice(0, 8).map((c) => {
                      const t = telemetryByComputer[c.id];
                      return (
                        <button key={c.id} onClick={() => { setSelectedComputerId(c.id); }} title="View computer details">
                          <div>
                            <Monitor size={14} />
                            <span className={`badge ${statusClass(c.status)}`}><i />{statusLabel(c.status)}</span>
                          </div>
                          <b>{c.hostname}</b>
                          <small>
                            CPU {t?.cpuUsage != null ? clampUsage(t.cpuUsage).toFixed(0) : '\u2014'}% &middot;
                            {' '}RAM {t?.ramUsage != null ? clampUsage(t.ramUsage).toFixed(0) : '\u2014'}%
                          </small>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <div className="bottom">
                <section className="card recent">
                  <div className="sectionhead">
                    <div>
                      <h2>Active faults</h2>
                      <p>REAL AGENT DETECTION</p>
                    </div>
                    <button onClick={() => switchNav('faults')}>
                      All faults <ChevronRight size={13} />
                    </button>
                  </div>
                  {activeFaults.length === 0 ? (
                    <div style={{ padding: '24px 8px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 12 }}>
                      <CheckCircle2 size={18} style={{ color: '#32d6a0' }} />
                      <b style={{ color: 'var(--text)' }}>No faults detected.</b>
                      <span>&mdash; All agent telemetry is within configured thresholds.</span>
                    </div>
                  ) : (
                    <div className="table">
                      <table>
                        <thead>
                          <tr>
                            <th>Computer</th>
                            <th>Fault</th>
                            <th>Severity</th>
                            <th>Value / Threshold</th>
                            <th>Detected</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {activeFaults.slice(0, 10).map((f) => (
                            <tr key={f.id}>
                              <td>
                                <b>{f.computer?.hostname ?? '\u2014'}</b>
                                <small>{f.computer?.ipAddress ?? f.computer?.operatingSystem ?? ''}</small>
                              </td>
                              <td>
                                <b>{f.message}</b>
                                <small>{f.type} &middot; {f.metric ?? ''}</small>
                              </td>
                              <td>
                                <span className={`badge ${severityClass(f.severity)}`}>
                                  <i /> {severityLabel(f.severity)}
                                </span>
                              </td>
                              <td>
                                <b>{f.currentValue != null ? `${f.currentValue.toFixed(1)}%` : '\u2014'} / {f.threshold != null ? `${f.threshold.toFixed(1)}%` : '\u2014'}</b>
                              </td>
                              <td><small>{formatDateShort(f.detectedAt)}</small></td>
                              <td>
                                <button className="ghost" onClick={() => setViewingFaultId(f.id)} title="View fault details"><Eye size={13} /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="card quick">
                  <div className="sectionhead">
                    <div>
                      <h2>Quick actions</h2>
                      <p>OPERATIONS</p>
                    </div>
                  </div>
                  <p>Manage monitoring, review reports, and inspect individual systems.</p>
                  <button onClick={() => switchNav('computers')}>
                    <Monitor size={15} /> Inventory <ChevronRight size={13} />
                  </button>
                  <button onClick={() => { setSelectedFaultFilter('ACTIVE'); switchNav('faults'); }}>
                    <AlertTriangle size={15} /> Faults <ChevronRight size={13} />
                  </button>
                  <button onClick={() => switchNav('reports')}>
                    <FileText size={15} /> Reports <ChevronRight size={13} />
                  </button>
                  <button onClick={() => { setActiveSettings('general'); switchNav('settings'); }}>
                    <Wrench size={15} /> Settings <ChevronRight size={13} />
                  </button>
                  <button onClick={() => void load({ showSpinner: true })} disabled={refreshing}>
                    {refreshing ? <Loader2 size={15} className="spin" /> : <Activity size={15} />}
                    {refreshing ? 'Refreshing data' : ' Refresh data'} <ChevronRight size={13} />
                  </button>
                </section>
              </div>
            </>
          )}

          {activeNav === 'computers' && (
            <section className="card datacard">
              <div className="sectionhead">
                <div>
                  <h2>Computer inventory</h2>
                  <p>ALL REGISTERED AGENTS</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ color: 'var(--muted)', fontSize: 11 }}>
                    {filteredComputers.length} of {computers.length} shown
                  </div>
                  <button className="ghost" onClick={() => void load({ showSpinner: true })} disabled={refreshing} title="Refresh inventory">
                    {refreshing ? <Loader2 size={13} className="spin" /> : <ArrowUpDown size={13} />}
                  </button>
                </div>
              </div>
              {computers.length === 0 ? (
                <div style={{ padding: '60px 16px', textAlign: 'center' }}>
                  <Server size={36} style={{ opacity: 0.5, color: 'var(--muted)', marginBottom: 14 }} />
                  <div style={{ fontSize: 15, fontWeight: 700 }}>No PC Guard agents connected</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8, maxWidth: 520, margin: '0 auto' }}>
                    Run the PC Guard Java Agent on a machine. It will register automatically and appear here with live telemetry.
                  </div>
                </div>
              ) : filteredComputers.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                  <Search size={22} style={{ marginBottom: 8 }} />
                  No computers match &ldquo;{searchText}&rdquo;.
                </div>
              ) : (
                <div className="pcgrid">
                  {filteredComputers.map((c) => {
                    const t = telemetryByComputer[c.id];
                    const cpuPct = clampUsage(t?.cpuUsage);
                    const ramPct = clampUsage(t?.ramUsage);
                    const storPct = clampUsage(t?.storageUsage);
                    return (
                      <div
                        key={c.id}
                        className="pccard"
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedComputerId(c.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedComputerId(c.id); } }}
                        title="View computer details"
                      >
                        <div>
                          <Monitor size={14} />
                          <span className={`badge ${statusClass(c.status)}`}><i />{statusLabel(c.status)}</span>
                        </div>
                        <h3>{c.hostname}</h3>
                        <p>
                          {c.operatingSystem ?? 'Unknown OS'}
                          {c.osVersion ? ` ${c.osVersion}` : ''} &middot; {c.architecture ?? ''}
                        </p>
                        <div className="usage">
                          <span>Cpu <b>{cpuPct.toFixed(0)}%</b></span>
                          <i><b style={{ width: `${cpuPct}%`, background: cpuPct >= settings.cpuWarnPct ? '#f4ba4b' : undefined }} /></i>
                          <span>Ram <b>{ramPct.toFixed(0)}%</b></span>
                          <i><b style={{ width: `${ramPct}%`, background: ramPct >= settings.ramWarnPct ? '#f4ba4b' : undefined }} /></i>
                          <span>Disk <b>{storPct.toFixed(0)}%</b></span>
                          <i><b style={{ width: `${storPct}%`, background: storPct >= settings.diskWarnPct ? '#f4ba4b' : undefined }} /></i>
                        </div>
                        <footer>
                          <Clock size={11} /> <span>{formatDateShort(c.lastSeen)}</span>
                          <button
                            type="button"
                            className="action-btn"
                            onClick={(e) => { e.stopPropagation(); setSelectedComputerId(c.id); }}
                            title="View computer details"
                            aria-label="View computer details"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            className="action-btn danger"
                            onClick={(e) => { e.stopPropagation(); void deleteComputer(c.id, c.hostname); }}
                            title="Remove agent from monitoring"
                            aria-label="Remove agent from monitoring"
                            disabled={isDeletingComputer(c.id)}
                          >
                            {isDeletingComputer(c.id) ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
                          </button>
                        </footer>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {activeNav === 'faults' && (
            <section className="card datacard">
              <div className="sectionhead">
                <div>
                  <h2>Faults management</h2>
                  <p>GENERATED SERVER-SIDE BY TELEMETRY EVALUATION</p>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 11 }}>
                  Showing {displayedFaults.length} / {faults.length}
                </div>
              </div>
              {displayedFaults.length === 0 ? (
                <div style={{ padding: '60px 16px', textAlign: 'center' }}>
                  <CheckCircle2 size={36} style={{ color: '#32d6a0', marginBottom: 14 }} />
                  <div style={{ fontSize: 15, fontWeight: 700 }}>
                    {selectedFaultFilter === 'ACTIVE'
                      ? 'No active faults'
                      : selectedFaultFilter === 'RESOLVED'
                        ? 'No resolved faults recorded yet'
                        : 'No faults recorded yet'}
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
                    {selectedFaultFilter === 'ACTIVE'
                      ? 'All connected PC Guard agents are reporting metrics within configured thresholds.'
                      : 'As faults are detected and processed they will appear here.'}
                  </div>
                </div>
              ) : (
                <div className="table">
                  <table>
                    <thead>
                      <tr>
                        <th>Computer</th>
                        <th>Fault</th>
                        <th>Severity</th>
                        <th>Status</th>
                        <th>Metric</th>
                        <th>Value / Threshold</th>
                        <th>Detected</th>
                        <th>Resolved</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {displayedFaults.map((f) => (
                        <tr key={f.id}>
                          <td>
                            <b>{f.computer?.hostname ?? '\u2014'}</b>
                            <small>{f.computer?.ipAddress ?? ''}</small>
                          </td>
                          <td>
                            <b>{f.message}</b>
                            <small>{f.type}</small>
                          </td>
                          <td>
                            <span className={`badge ${severityClass(f.severity)}`}><i /> {severityLabel(f.severity)}</span>
                          </td>
                          <td>
                            <span className={`badge ${f.status === 'ACTIVE' ? 'warning' : 'resolved'}`}><i />{f.status}</span>
                          </td>
                          <td><small>{f.metric ?? '\u2014'}</small></td>
                          <td>
                            <b>{f.currentValue != null ? `${f.currentValue.toFixed(1)}%` : '\u2014'} / {f.threshold != null ? `${f.threshold.toFixed(1)}%` : '\u2014'}</b>
                          </td>
                          <td><small>{formatDateShort(f.detectedAt)}</small></td>
                          <td><small>{formatDateShort(f.resolvedAt)}</small></td>
                          <td style={{ display: 'flex', gap: 6 }}>
                            <button className="ghost" onClick={() => setViewingFaultId(f.id)} title="View fault details"><Eye size={13} /></button>
                            <button className="ghost" onClick={() => setSelectedComputerId(f.computer?.id ?? null)} title="Go to computer"><Monitor size={13} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeNav === 'reports' && (
            <section className="card datacard">
              <div className="sectionhead">
                <div>
                  <h2>System reports</h2>
                  <p>AUTOMATIC FAULT &amp; RECOVERY REPORTS</p>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 11 }}>{reports.length} total</div>
              </div>
              {reports.length === 0 ? (
                <div style={{ padding: '60px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                  <FileText size={36} style={{ marginBottom: 14, opacity: 0.5 }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>No reports available.</div>
                  <div style={{ marginTop: 8 }}>Reports are generated automatically when faults are detected and resolved.</div>
                </div>
              ) : (
                <div className="table">
                  <table>
                    <thead>
                      <tr>
                        <th>Computer</th>
                        <th>Type</th>
                        <th>Report</th>
                        <th>Severity</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <b>{r.computer?.hostname ?? '\u2014'}</b>
                            <small>{r.computer?.ipAddress ?? ''}</small>
                          </td>
                          <td><small>{r.reportType}</small></td>
                          <td>
                            <b>{r.title}</b>
                            <small>{r.description ?? ''}</small>
                          </td>
                          <td>
                            {r.severity ? (
                              <span className={`badge ${severityClass(r.severity)}`}><i /> {severityLabel(r.severity)}</span>
                            ) : <small>\u2014</small>}
                          </td>
                          <td><span className={`badge ${r.status === 'COMPLETED' || r.status === 'RESOLVED' ? 'healthy' : r.status === 'SCHEDULED' ? 'scheduled' : 'warning'}`}><i />{r.status}</span></td>
                          <td><small>{formatDateShort(r.createdAt)}</small></td>
                          <td style={{ display: 'flex', gap: 6 }}>
                            <button className="ghost" title="View report" onClick={() => setSelectedReportId(r.id)}><Eye size={13} /></button>
                            <button className="ghost" title="Download report" aria-label="Download report" onClick={() => downloadReport(r)}><Download size={13} /></button>
                            <button className="ghost" title="Go to computer" onClick={() => setSelectedComputerId(r.computer?.id ?? null)}><Monitor size={13} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeNav === 'activity' && (
            <section className="card notifications">
              <div className="sectionhead">
                <div>
                  <h2>Recent events</h2>
                  <p>FAULTS, RECOVERIES &amp; REPORTS</p>
                </div>
                <button className="ghost" onClick={() => void load({ showSpinner: true })} disabled={refreshing}>
                  {refreshing ? <Loader2 size={13} className="spin" /> : <Activity size={13} />} Refresh
                </button>
              </div>
              {activeFaults.length === 0 && reports.length === 0 ? (
                <div style={{ padding: '60px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                  <Activity size={36} style={{ marginBottom: 14, opacity: 0.5 }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>No events yet.</div>
                  <div style={{ marginTop: 8 }}>Activity appears when agent telemetry produces new faults or recoveries.</div>
                </div>
              ) : (
                [...activeFaults.map((f) => ({ kind: 'fault' as const, id: `f${f.id}`, time: f.detectedAt, data: f })),
                 ...reports.map((r) => ({ kind: 'report' as const, id: `r${r.id}`, time: r.createdAt, data: r }))]
                  .sort((a, b) => +new Date(b.time) - +new Date(a.time))
                  .slice(0, 50)
                  .map((entry, i) => {
                    const Icon = entry.kind === 'fault' ? AlertTriangle : FileText;
                    const ni = entry.kind === 'fault' ? ((entry.data as Fault).severity === 'CRITICAL' ? 'n0' : 'n2') : `n${(i + 3) % 5}`;
                    const host = (entry.data as Fault).computer?.hostname ?? (entry.data as Report).computer?.hostname ?? '\u2014';
                    const title = entry.kind === 'fault' ? (entry.data as Fault).message : (entry.data as Report).title;
                    const desc = entry.kind === 'fault' ? (entry.data as Fault).metric ?? '' : (entry.data as Report).description ?? '';
                    return (
                      <article
                        key={entry.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => { if (entry.kind === 'fault') setViewingFaultId((entry.data as Fault).id); else setSelectedReportId((entry.data as Report).id); }}
                      >
                        <div className={`ni ${ni}`}><Icon size={16} /></div>
                        <span>
                          <b>{host}</b>
                          <small>{title} {desc ? `&mdash; ${desc}` : ''}</small>
                        </span>
                        <time>{formatDateShort(entry.time)}</time>
                      </article>
                    );
                  })
              )}
            </section>
          )}

          {activeNav === 'settings' && (
            <div className="settings">
              <section className="card settingnav">
                {(['MONITORING', 'EXPERIENCE', 'INTEGRATIONS', 'SYSTEM'] as const).map((group) => (
                  <div key={group}>
                    <b>{group}</b>
                    {SETTINGS_SECTIONS.filter((s) => s.group === group).map((s) => {
                      const Icon = s.icon;
                      return (
                        <button
                          key={s.id}
                          className={activeSettings === s.id ? 'active' : ''}
                          onClick={() => { setActiveSettings(s.id); }}
                        >
                          <Icon size={16} /> {s.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
                <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="primary" onClick={applyDraft} disabled={!settingsDirty} style={{ flex: 1, height: 34 }}>
                    <Save size={13} /> {settingsDirty ? 'Save changes' : 'Saved'}
                  </button>
                  <button className="ghost" onClick={resetDraft} disabled={!settingsDirty} style={{ flex: 1, height: 34 }}>
                    <RotateCcw size={13} /> Reset draft
                  </button>
                  <button className="ghost" onClick={restoreDefaults} style={{ width: '100%', height: 32, color: '#fb6873' }}>
                    <Power size={12} /> Restore defaults
                  </button>
                </div>
              </section>

              <section className="card settingpanel">
                {activeSettings === 'general' && (
                  <>
                    <p>MONITORING</p>
                    <h2>General settings</h2>
                    <div className="toggle">
                      <span>
                        <b>Sidebar default</b>
                        <small>Start with sidebar collapsed or expanded. Updated immediately in the UI after save.</small>
                      </span>
                      <span style={{ alignItems: 'center', gap: 8, display: 'flex', fontSize: 11 }}>
                        <input
                          type="checkbox"
                          checked={draftSettings.sidebarCollapsed}
                          onChange={() => setDraftSettings({ ...draftSettings, sidebarCollapsed: !draftSettings.sidebarCollapsed })}
                          aria-label="Sidebar default"
                        />
                        <i />
                        {draftSettings.sidebarCollapsed ? 'Collapsed' : 'Expanded'}
                      </span>
                    </div>
                    <div className="toggle">
                      <span>
                        <b>Compact density</b>
                        <small>Reduce spacing inside cards for denser monitoring views.</small>
                      </span>
                      <span style={{ alignItems: 'center', gap: 8, display: 'flex', fontSize: 11 }}>
                        <input
                          type="checkbox"
                          checked={draftSettings.compactDensity}
                          onChange={() => setDraftSettings({ ...draftSettings, compactDensity: !draftSettings.compactDensity })}
                          aria-label="Compact density"
                        />
                        <i />
                        {draftSettings.compactDensity ? 'Compact' : 'Comfortable'}
                      </span>
                    </div>
                    <div className="toggle">
                      <span>
                        <b>Show metric sparklines</b>
                        <small>Show decorative progress bars on Dashboard metric cards.</small>
                      </span>
                      <span style={{ alignItems: 'center', gap: 8, display: 'flex', fontSize: 11 }}>
                        <input
                          type="checkbox"
                          checked={draftSettings.showSparklines}
                          onChange={() => setDraftSettings({ ...draftSettings, showSparklines: !draftSettings.showSparklines })}
                          aria-label="Show metric sparklines"
                        />
                        <i />
                        {draftSettings.showSparklines ? 'Shown' : 'Hidden'}
                      </span>
                    </div>
                  </>
                )}

                {activeSettings === 'appearance' && (
                  <>
                    <p>EXPERIENCE</p>
                    <h2>Appearance</h2>
                    <h3>Theme</h3>
                    <div className="themes">
                      {THEMES.map((th) => {
                        const selected = draftSettings.theme === th.id;
                        return (
                          <button
                            key={th.id}
                            className={`${th.id} ${selected ? 'selected' : ''}`}
                            onClick={() => {
                              const next = { ...draftSettings, theme: th.id };
                              setDraftSettings(next);
                              applyTheme(th.id);
                            }}
                          >
                            <i /> {th.label}
                            {selected ? <CheckCircle2 size={14} /> : <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 9 }}>Preview</span>}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: 18, color: 'var(--muted)', fontSize: 11 }}>
                      Preview is applied immediately. Theme is saved to your browser when you click <b>Save changes</b>.
                    </div>
                  </>
                )}

                {activeSettings === 'notifications' && (
                  <>
                    <p>EXPERIENCE</p>
                    <h2>Notifications</h2>
                    <div className="toggle">
                      <span>
                        <b>Bell enabled</b>
                        <small>Show unread badge and open notification tray from the header.</small>
                      </span>
                      <span style={{ alignItems: 'center', gap: 8, display: 'flex', fontSize: 11 }}>
                        <input
                          type="checkbox"
                          checked={draftSettings.bellEnabled}
                          onChange={() => setDraftSettings({ ...draftSettings, bellEnabled: !draftSettings.bellEnabled })}
                          aria-label="Bell enabled"
                        />
                        <i />
                        {draftSettings.bellEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="toggle">
                      <span>
                        <b>Sound alerts</b>
                        <small>Play a short beep when a new critical fault is received.</small>
                      </span>
                      <span style={{ alignItems: 'center', gap: 8, display: 'flex', fontSize: 11 }}>
                        <input
                          type="checkbox"
                          checked={draftSettings.soundEnabled}
                          onChange={() => setDraftSettings({ ...draftSettings, soundEnabled: !draftSettings.soundEnabled })}
                          aria-label="Sound alerts"
                        />
                        <i />
                        {draftSettings.soundEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="toggle">
                      <span>
                        <b>Critical / High only</b>
                        <small>Suppress informational, low and warning events in the notification tray. Active faults severity CRITICAL or HIGH only.</small>
                      </span>
                      <span style={{ alignItems: 'center', gap: 8, display: 'flex', fontSize: 11 }}>
                        <input
                          type="checkbox"
                          checked={draftSettings.notifyCriticalOnly}
                          onChange={() => setDraftSettings({ ...draftSettings, notifyCriticalOnly: !draftSettings.notifyCriticalOnly })}
                          aria-label="Critical / High only"
                        />
                        <i />
                        {draftSettings.notifyCriticalOnly ? 'Enabled' : 'All severities'}
                      </span>
                    </div>
                  </>
                )}

                {activeSettings === 'monitoring' && (
                  <>
                    <p>MONITORING</p>
                    <h2>Monitoring thresholds</h2>
                    <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: -4 }}>
                      These thresholds turn the matching inventory usage bar amber. The server generates real faults using its own thresholds; these do not change server behaviour.
                    </div>
                    <div className="toggle" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14 }}>
                      <span>
                        <b>CPU warning (%)</b>
                        <small>Highlight the CPU usage bar at and above this percentage.</small>
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={draftSettings.cpuWarnPct}
                        onChange={(e) => setDraftSettings({ ...draftSettings, cpuWarnPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                        style={{
                          background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '6px 10px', width: 100,
                        }}
                      />
                    </div>
                    <div className="toggle" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14 }}>
                      <span>
                        <b>RAM warning (%)</b>
                        <small>Highlight the RAM usage bar at and above this percentage.</small>
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={draftSettings.ramWarnPct}
                        onChange={(e) => setDraftSettings({ ...draftSettings, ramWarnPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                        style={{
                          background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '6px 10px', width: 100,
                        }}
                      />
                    </div>
                    <div className="toggle" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14 }}>
                      <span>
                        <b>Disk warning (%)</b>
                        <small>Highlight the storage usage bar at and above this percentage.</small>
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={draftSettings.diskWarnPct}
                        onChange={(e) => setDraftSettings({ ...draftSettings, diskWarnPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                        style={{
                          background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '6px 10px', width: 100,
                        }}
                      />
                    </div>
                  </>
                )}

                {activeSettings === 'dashboard' && (
                  <>
                    <p>MONITORING</p>
                    <h2>Dashboard defaults</h2>
                    <div className="toggle">
                      <span>
                        <b>Landing page</b>
                        <small>Page shown when the app first loads (after a hard refresh).</small>
                      </span>
                      <div className="segment">
                        {NAV_ITEMS.map((n) => (
                          <button
                            key={n.id}
                            className={draftSettings.defaultNav === n.id ? 'selected' : ''}
                            onClick={() => setDraftSettings({ ...draftSettings, defaultNav: n.id })}
                          >
                            {n.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="toggle">
                      <span>
                        <b>Automatic refresh</b>
                        <small>Periodically re-fetch monitoring data without needing to click Refresh.</small>
                      </span>
                      <span style={{ alignItems: 'center', gap: 8, display: 'flex', fontSize: 11 }}>
                        <input
                          type="checkbox"
                          checked={draftSettings.autoRefreshEnabled}
                          onChange={() => setDraftSettings({ ...draftSettings, autoRefreshEnabled: !draftSettings.autoRefreshEnabled })}
                          aria-label="Automatic refresh"
                        />
                        <i />
                        {draftSettings.autoRefreshEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="toggle" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14 }}>
                      <span>
                        <b>Refresh interval (seconds)</b>
                        <small>Minimum 5 seconds. Only used when automatic refresh is enabled.</small>
                      </span>
                      <input
                        type="number"
                        min={5}
                        max={900}
                        value={draftSettings.refreshIntervalSec}
                        disabled={!draftSettings.autoRefreshEnabled}
                        onChange={(e) => setDraftSettings({ ...draftSettings, refreshIntervalSec: Math.max(5, Math.min(900, Number(e.target.value) || 5)) })}
                        style={{
                          background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '6px 10px', width: 100,
                          opacity: draftSettings.autoRefreshEnabled ? 1 : 0.6,
                        }}
                      />
                    </div>
                  </>
                )}

                {activeSettings === 'api' && (
                  <>
                    <p>INTEGRATIONS</p>
                    <h2>API / Connection</h2>
                    <div className="toggle" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <b>Backend API base URL</b>
                        <span className={`badge ${backendHealth === 'live' ? 'healthy' : backendHealth === 'error' ? 'critical' : backendHealth === 'connecting' ? 'warning' : 'offline'}`} style={{ marginLeft: 'auto' }}>
                          <i /> {backendHealth === 'live' ? (sseOk === 'connected' ? 'SSE connected' : 'REST connected') : backendHealth === 'error' ? 'Configuration error' : backendHealth === 'connecting' ? 'Connecting…' : 'Offline'}
                        </span>
                      </div>
                      <input
                        type="url"
                        value={draftSettings.apiBaseUrl}
                        onChange={(e) => setDraftSettings({ ...draftSettings, apiBaseUrl: e.target.value.replace(/\/$/, '') })}
                        placeholder="http://localhost:8080/api/v1"
                        style={{
                          width: '100%', background: 'var(--card2)', border: '1px solid var(--border)', color: 'var(--text)',
                          borderRadius: 8, padding: '10px 12px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12,
                        }}
                      />
                      <small style={{ color: 'var(--muted)' }}>
                        Current URL: <code style={{ background: 'var(--border)', padding: '2px 6px', borderRadius: 4 }}>{draftSettings.apiBaseUrl || '\u2014'}</code>
                        {' '}&middot; Save changes to switch the application and live-event connection to this URL.
                      </small>
                    </div>
                    <div className="toggle">
                      <span>
                        <b>Live events</b>
                        <small>SSE push updates use the saved API base URL. {sseOk === 'connected' ? 'Streaming now.' : 'REST remains available while events reconnect.'}</small>
                      </span>
                      <span className={`badge ${sseOk === 'connected' ? 'healthy' : 'offline'}`}>
                        <i /> {sseOk === 'connected' ? 'Streaming' : 'Offline'}
                      </span>
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                      <button className="primary" onClick={() => void testConnection()} disabled={testingConnection} style={{ height: 34 }}>
                        {testingConnection ? <Loader2 size={14} className="spin" /> : <Activity size={14} />}
                        {' '}Test connection
                      </button>
                      <button className="ghost" onClick={() => setDraftSettings({ ...draftSettings, apiBaseUrl: DEFAULT_SETTINGS.apiBaseUrl })} style={{ height: 34 }}>
                        <RotateCcw size={13} /> Reset to default
                      </button>
                    </div>
                  </>
                )}

                {activeSettings === 'data' && (
                  <>
                    <p>SYSTEM</p>
                    <h2>Data &amp; inventory</h2>
                    <div className="toggle">
                      <span>
                        <b>Inventory</b>
                        <small>{computers.length} registered computer{computers.length === 1 ? '' : 's'} &middot; {reports.length} report{reports.length === 1 ? '' : 's'} &middot; {faults.length} total fault record{faults.length === 1 ? '' : 's'}</small>
                      </span>
                      <button className="ghost" onClick={() => switchNav('computers')} style={{ height: 32 }}><Monitor size={13} /> Open inventory</button>
                    </div>
                    <div className="toggle">
                      <span>
                        <b>Remove stale / test agents</b>
                        <small>Delete stale test records (e.g. hostname TEST-PC, agentId test-direct) via the inventory view. Use the trash icon on each computer card.</small>
                      </span>
                    </div>
                    <div className="toggle">
                      <span>
                        <b>Clear local settings</b>
                        <small>Reset only browser preferences (theme, notifications, sidebar, etc.) without affecting the backend database.</small>
                      </span>
                      <button className="ghost" style={{ color: '#fb6873', height: 32 }} onClick={restoreDefaults}><Trash2 size={13} /> Reset saved preferences</button>
                    </div>
                  </>
                )}

                {activeSettings === 'about' && (
                  <>
                    <p>SYSTEM</p>
                    <h2>About PC Guard</h2>
                    <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.7, color: 'var(--muted)' }}>
                      PC Guard is a real-time computer monitoring platform consisting of:
                      <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
                        <li><b>Backend:</b> Spring Boot 4.1.1 / PostgreSQL 17 / Flyway 2 migrations</li>
                        <li><b>Agent:</b> Java monitoring agent using the OSHI hardware collector</li>
                        <li><b>Frontend:</b> React 19 / TypeScript / Vite / Recharts / Tailwind 4</li>
                        <li><b>Live updates:</b> Server-Sent Events (<code style={{ background: 'var(--border)', padding: '2px 6px', borderRadius: 4 }}>/api/v1/events</code>) plus polling fallback</li>
                      </ul>
                    </div>
                    <div className="toggle">
                      <span><b>Installed at</b><small>{formatDate(settings.installedAt)}</small></span>
                      <Info size={17} style={{ color: 'var(--muted)' }} />
                    </div>
                    <div className="toggle">
                      <span>
                        <b>Current API base</b>
                        <small>{settings.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl} {settingsDirty && '(unsaved draft differs)'}</small>
                      </span>
                      <span className={`badge ${backendHealth === 'live' ? 'healthy' : backendHealth === 'error' ? 'critical' : backendHealth === 'connecting' ? 'warning' : 'offline'}`}>
                        <i /> {backendHealth === 'live' ? 'LIVE' : backendHealth === 'error' ? 'ERROR' : backendHealth === 'connecting' ? 'CONNECTING' : 'STANDBY'}
                      </span>
                    </div>
                    <div className="toggle">
                      <span><b>Version</b><small>PC Guard 1.0.0 &middot; Frontend build 0.0.0</small></span>
                    </div>
                  </>
                )}

                <div style={{
                  marginTop: 26, borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end',
                }}>
                  <button className="ghost" onClick={resetDraft} disabled={!settingsDirty} style={{ height: 38 }}>
                    <RotateCcw size={14} /> Cancel draft
                  </button>
                  <button className="primary" onClick={applyDraft} disabled={!settingsDirty} style={{ height: 38 }}>
                    <Save size={14} /> Save {settingsDirty ? 'changes' : 'settings'}
                  </button>
                </div>
              </section>
            </div>
          )}
          </div>
        </div>
      </main>

      {selectedComputer && (
        <div className="backdrop" onClick={() => setSelectedComputerId(null)}>
          <div className="details card" onClick={(e) => e.stopPropagation()} style={{ width: 880 }}>
            <button className="x" onClick={() => setSelectedComputerId(null)} aria-label="Close">
              <X size={18} />
            </button>
            <div className="detailhead">
              <div className="pcico"><Monitor size={22} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p>COMPUTER DETAILS</p>
                <h2>{selectedComputer.hostname}</h2>
                <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>
                  Agent <code style={{ background: 'var(--border)', padding: '2px 6px', borderRadius: 4 }}>{selectedComputer.agentId}</code>
                  {' '}&middot; Registered {formatDate(selectedComputer.registeredAt)}
                </div>
              </div>
              <span className={`badge ${statusClass(selectedComputer.status)}`} style={{ alignSelf: 'flex-start' }}>
                <i /> {statusLabel(selectedComputer.status)}
              </span>
            </div>

            <div className="detailmetrics">
              <div>
                <small><Cpu size={11} style={{ verticalAlign: -1 }} /> CPU</small>
                <b>{selectedTelemetry?.cpuUsage != null ? `${clampUsage(selectedTelemetry.cpuUsage).toFixed(1)}%` : '\u2014'}</b>
                <small>
                  Temperature: <b style={{ color: selectedTelemetry?.cpuTemperature != null ? 'var(--text)' : 'var(--muted)' }}>{formatTemp(selectedTelemetry?.cpuTemperature)}</b>
                </small>
              </div>
              <div>
                <small><MemoryStick size={11} style={{ verticalAlign: -1 }} /> RAM</small>
                <b>{selectedTelemetry?.ramUsage != null ? `${clampUsage(selectedTelemetry.ramUsage).toFixed(1)}%` : '\u2014'}</b>
                <small>{formatBytes(selectedTelemetry?.ramUsed)} / {formatBytes(selectedTelemetry?.ramTotal)} &middot; Avail {formatBytes(selectedTelemetry?.ramAvailable)}</small>
              </div>
              <div>
                <small><HardDrive size={11} style={{ verticalAlign: -1 }} /> STORAGE</small>
                <b>{selectedTelemetry?.storageUsage != null ? `${clampUsage(selectedTelemetry.storageUsage).toFixed(1)}%` : '\u2014'}</b>
                <small>{formatBytes(selectedTelemetry?.storageUsed)} / {formatBytes(selectedTelemetry?.storageTotal)} &middot; Free {formatBytes(selectedTelemetry?.storageFree ?? ((selectedTelemetry?.storageTotal != null && selectedTelemetry?.storageUsed != null) ? ((selectedTelemetry.storageTotal as number) - (selectedTelemetry.storageUsed as number)) : undefined))}</small>
              </div>
              <div>
                <small><Network size={11} style={{ verticalAlign: -1 }} /> NETWORK</small>
                <b>{selectedTelemetry?.networkStatus ?? '\u2014'}</b>
                <small>\u2193 {formatBytes(selectedTelemetry?.networkDownload)} &middot; \u2191 {formatBytes(selectedTelemetry?.networkUpload)}</small>
              </div>
            </div>

            <h3>System information</h3>
            <div className="equip">
              <span><i className="healthy" /> Operating System <b>{selectedComputer.operatingSystem ?? '\u2014'} {selectedComputer.osVersion ?? ''}</b></span>
              <span><i className="healthy" /> Architecture <b>{selectedComputer.architecture ?? '\u2014'}</b></span>
              <span><i className={selectedComputer.ipAddress ? 'healthy' : 'red'} /> IP <b>{selectedComputer.ipAddress ?? '\u2014'}</b></span>
              <span><i className="healthy" /> Agent version <b>{selectedComputer.agentVersion ?? '\u2014'}</b></span>
              <span><i className="healthy" /> Last seen <b>{formatDate(selectedComputer.lastSeen)}</b></span>
              <span><i className={selectedTelemetry?.uptime ? 'healthy' : 'offline'} /> Uptime <b>{selectedTelemetry?.uptime ? `${Math.floor(selectedTelemetry.uptime / 86400)}d ${Math.floor((selectedTelemetry.uptime % 86400) / 3600)}h ${Math.floor(((selectedTelemetry.uptime % 86400) % 3600) / 60)}m` : '\u2014'}</b></span>
              <span><i className={selectedComputer.lastSeen ? 'healthy' : 'offline'} /> Agent check-in <b>{formatDateShort(selectedComputer.lastSeen)}</b></span>
            </div>

            <h3>Open faults for this machine</h3>
            {!selectedComputerFaults ? (
              <div style={{ padding: 16, fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Loader2 size={14} className="spin" /> Loading fault records\u2026
              </div>
            ) : selectedComputerFaults.filter((f) => f.status === 'ACTIVE').length === 0 ? (
              <div style={{ padding: 16, color: 'var(--muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} style={{ color: '#32d6a0' }} />
                No active faults detected for this agent.
                {selectedComputerFaults.length > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: 11 }}>{selectedComputerFaults.length} historical fault record{selectedComputerFaults.length === 1 ? '' : 's'}.</span>
                )}
              </div>
            ) : (
              <div className="table">
                <table>
                  <thead>
                    <tr>
                      <th>Fault</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Value / Threshold</th>
                      <th>Detected</th>
                      <th>Resolved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedComputerFaults.map((f) => (
                      <tr key={f.id}>
                        <td><b>{f.message}</b><small>{f.type} &middot; {f.metric ?? ''}</small></td>
                        <td><span className={`badge ${severityClass(f.severity)}`}><i />{severityLabel(f.severity)}</span></td>
                        <td><span className={`badge ${f.status === 'ACTIVE' ? 'warning' : 'resolved'}`}><i />{f.status}</span></td>
                        <td><b>{num(f.currentValue)} / {num(f.threshold)}</b></td>
                        <td><small>{formatDateShort(f.detectedAt)}</small></td>
                        <td><small>{formatDateShort(f.resolvedAt)}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3>Reports for this machine</h3>
            {!selectedComputerReports ? (
              <div style={{ padding: 16, fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Loader2 size={14} className="spin" /> Loading report records\u2026
              </div>
            ) : selectedComputerReports.length === 0 ? (
              <div style={{ padding: 16, color: 'var(--muted)', fontSize: 12 }}>
                No reports yet. Reports are generated automatically when faults are detected and resolved by the monitoring server.
              </div>
            ) : (
              <div className="table">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {selectedComputerReports.slice(0, 10).map((r) => (
                      <tr key={r.id}>
                        <td><b>{r.title}</b><small>{r.description ?? ''}</small></td>
                        <td><small>{r.reportType}</small></td>
                        <td>{r.severity ? <span className={`badge ${severityClass(r.severity)}`}><i />{severityLabel(r.severity)}</span> : <small>\u2014</small>}</td>
                        <td><span className={`badge ${r.status === 'COMPLETED' || r.status === 'RESOLVED' ? 'healthy' : r.status === 'SCHEDULED' ? 'scheduled' : 'warning'}`}><i />{r.status}</span></td>
                        <td><small>{formatDateShort(r.createdAt)}</small></td>
                        <td style={{ display: 'flex', gap: 6 }}>
                          <button className="ghost" onClick={() => setSelectedReportId(r.id)} title="View report"><Eye size={13} /></button>
                          <button className="ghost" title="Download" aria-label="Download report" onClick={() => downloadReport(r)}><Download size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="detailactions">
              <button className="primary" onClick={() => void refreshComputerData(selectedComputer.id, selectedComputer.hostname)} disabled={refreshingComputerId === selectedComputer.id}>
                {refreshingComputerId === selectedComputer.id ? <Loader2 size={13} className="spin" /> : <Activity size={13} />} {refreshingComputerId === selectedComputer.id ? 'Refreshing…' : 'Refresh data'}
              </button>
              <button onClick={() => switchNav('computers')}>
                <Monitor size={13} /> Inventory
              </button>
              <button onClick={() => setSelectedComputerId(null)}>
                <Minus size={13} /> Close
              </button>
              <button
                type="button"
                onClick={() => void deleteComputer(selectedComputer.id, selectedComputer.hostname)}
                style={{ marginLeft: 'auto', borderColor: '#fb687340', color: '#fb6873' }}
                disabled={isDeletingComputer(selectedComputer.id)}
              >
                {isDeletingComputer(selectedComputer.id) ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
                {' '}{isDeletingComputer(selectedComputer.id) ? 'Removing…' : 'Remove agent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedReport && (
        <div className="backdrop" onClick={() => setSelectedReportId(null)}>
          <div className="details card" onClick={(e) => e.stopPropagation()} style={{ width: 650 }}>
            <button className="x" onClick={() => setSelectedReportId(null)}><X size={18} /></button>
            <div className="detailhead">
              <div className="pcico" style={{ background: 'linear-gradient(135deg,#58a6ff,#8b76ff)' }}><FileText size={22} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p>REPORT</p>
                <h2>{selectedReport.title}</h2>
                <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>
                  Created {formatDate(selectedReport.createdAt)} &middot; Type <b>{selectedReport.reportType}</b>
                </div>
              </div>
              <span className={`badge ${selectedReport.status === 'COMPLETED' || selectedReport.status === 'RESOLVED' ? 'healthy' : selectedReport.status === 'SCHEDULED' ? 'scheduled' : 'warning'}`} style={{ alignSelf: 'flex-start' }}>
                <i /> {selectedReport.status}
              </span>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
              <div style={{ marginTop: 10 }}><b style={{ color: 'var(--text)' }}>Computer:</b> {selectedReport.computer?.hostname ?? '\u2014'} {selectedReport.computer?.ipAddress ? `(${selectedReport.computer.ipAddress})` : ''}</div>
              {selectedReport.severity && (
                <div style={{ marginTop: 8 }}>
                  <b style={{ color: 'var(--text)' }}>Severity:</b> <span className={`badge ${severityClass(selectedReport.severity)}`}><i />{severityLabel(selectedReport.severity)}</span>
                </div>
              )}
              {selectedReport.description && (
                <div style={{ marginTop: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card2)', fontSize: 12, color: 'var(--text)' }}>
                  {selectedReport.description}
                </div>
              )}
              {(selectedReport as any).content && (
                <pre style={{
                  marginTop: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card2)', fontSize: 11, overflow: 'auto',
                  maxHeight: 220, whiteSpace: 'pre-wrap', color: 'var(--text)',
                }}>{String((selectedReport as any).content)}</pre>
              )}
            </div>
            <div className="detailactions">
              <button
                className="primary"
                onClick={() => downloadReport(selectedReport)}
              >
                <Download size={13} /> Download JSON
              </button>
              <button onClick={() => setSelectedComputerId(selectedReport.computer?.id ?? null)}><Monitor size={13} /> Computer details</button>
              <button onClick={() => setSelectedReportId(null)}><Minus size={13} /> Close</button>
            </div>
          </div>
        </div>
      )}

      {viewingFault && (
        <div className="backdrop" onClick={() => setViewingFaultId(null)}>
          <div className="details card" onClick={(e) => e.stopPropagation()} style={{ width: 620 }}>
            <button className="x" onClick={() => setViewingFaultId(null)}><X size={18} /></button>
            <div className="detailhead">
              <div className="pcico" style={{ background: viewingFault.severity === 'CRITICAL' ? 'linear-gradient(135deg,#fb6873,#c85cff)' : 'linear-gradient(135deg,#f4ba4b,#f49731)' }}>
                <AlertTriangle size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p>FAULT DETAIL</p>
                <h2>{viewingFault.message}</h2>
                <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>
                  Type <b>{viewingFault.type}</b> &middot; Metric {viewingFault.metric ?? '\u2014'}
                </div>
              </div>
              <span className={`badge ${severityClass(viewingFault.severity)}`} style={{ alignSelf: 'flex-start' }}>
                <i /> {severityLabel(viewingFault.severity)}
              </span>
            </div>
            <div className="equip">
              <span><i className="healthy" /> Computer <b>{viewingFault.computer?.hostname ?? '\u2014'}</b></span>
              <span><i className={viewingFault.computer?.ipAddress ? 'healthy' : 'offline'} /> IP <b>{viewingFault.computer?.ipAddress ?? '\u2014'}</b></span>
              <span><i className="warning" /> Status <b>{viewingFault.status}</b></span>
              <span><i className="warning" /> Current <b>{num(viewingFault.currentValue)}%</b> / Threshold <b>{num(viewingFault.threshold)}%</b></span>
              <span><i className="healthy" /> Detected <b>{formatDate(viewingFault.detectedAt)}</b></span>
              <span><i className={viewingFault.resolvedAt ? 'healthy' : 'offline'} /> Resolved <b>{formatDate(viewingFault.resolvedAt)}</b></span>
            </div>
            <div className="detailactions">
              <button className="primary" onClick={() => { setViewingFaultId(null); setSelectedComputerId(viewingFault.computer?.id ?? null); }}>
                <Monitor size={13} /> Open computer details
              </button>
              <button onClick={() => setViewingFaultId(null)}><Minus size={13} /> Close</button>
            </div>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className="toast" style={{ borderLeftColor: t.type === 'ok' ? '#32d6a0' : '#fb6873' }}>
              {t.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} style={{ color: '#fb6873' }} />}
              <span>{t.msg}</span>
              <button onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))} aria-label="Dismiss"><X size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
