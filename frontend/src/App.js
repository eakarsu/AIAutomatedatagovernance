import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { authAPI } from './services/api';
import {
  LayoutDashboard,
  Database,
  Shield,
  Activity,
  GitBranch,
  FileText,
  ScrollText,
  Users,
  CheckCircle,
  Lock,
  BookOpen,
  ClipboardList,
  Bot,
  LogOut,
  Menu,
  X,
  Plane,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react';

// Lazy load heavy page components
const DashboardHome = React.lazy(() => import('./components/Dashboard'));
const CatalogPage = React.lazy(() => import('./components/DataCatalog'));
const ClassificationPage = React.lazy(() => import('./components/DataClassification'));
const QualityPage = React.lazy(() => import('./components/DataQuality'));
const LineagePage = React.lazy(() => import('./components/DataLineage'));
const MetadataPage = React.lazy(() => import('./components/MetadataManagement'));
const PoliciesPage = React.lazy(() => import('./components/DataPolicies'));
const StewardshipPage = React.lazy(() => import('./components/DataStewardship'));
const CompliancePage = React.lazy(() => import('./components/ComplianceMonitoring'));
const AccessControlPage = React.lazy(() => import('./components/AccessControl'));
const GlossaryPage = React.lazy(() => import('./components/DataGlossary'));
const AuditPage = React.lazy(() => import('./components/AuditLogs'));
const AIAssistantPage = React.lazy(() => import('./components/AIInsights'));
const AIAdvancedPage = React.lazy(() => import('./components/AIAdvancedFeatures'));

// ─── Auth Context ───────────────────────────────────────────────
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await authAPI.login({ email, password });
      const { token: jwt, user: userData } = res.data;
      localStorage.setItem('token', jwt);
      localStorage.setItem('user', JSON.stringify(userData));
      setToken(jwt);
      setUser(userData);
      toast.success(`Welcome back, ${userData.full_name || userData.email}!`);
      return true;
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Login failed. Please check your credentials.';
      toast.error(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    setLoading(true);
    try {
      const res = await authAPI.register({ ...userData, full_name: userData.name });
      const { token: jwt, user: newUser } = res.data;
      localStorage.setItem('token', jwt);
      localStorage.setItem('user', JSON.stringify(newUser));
      setToken(jwt);
      setUser(newUser);
      toast.success('Account created successfully!');
      return true;
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Registration failed.';
      toast.error(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    toast.info('You have been logged out.');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Protected Route ────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/" replace />;
  return children;
}

// ─── Login Page ─────────────────────────────────────────────────
function LoginPage() {
  const { login, register, loading, token } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer' });

  useEffect(() => {
    if (token) navigate('/dashboard', { replace: true });
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    let success;
    if (isRegister) {
      success = await register(form);
    } else {
      success = await login(form.email, form.password);
    }
    if (success) navigate('/dashboard', { replace: true });
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="login-page">
      <div className="login-bg-pattern" />
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <Plane size={32} />
          </div>
          <h1 className="login-title">SkyGov</h1>
          <p className="login-subtitle">Airline Data Governance Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {isRegister && (
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@airline.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {isRegister && (
            <div className="form-group">
              <label htmlFor="role">Role</label>
              <select id="role" name="role" value={form.role} onChange={handleChange}>
                <option value="viewer">Viewer</option>
                <option value="steward">Data Steward</option>
                <option value="analyst">Analyst</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? (
              <span className="btn-loading">
                <span className="spinner" />
                {isRegister ? 'Creating Account...' : 'Signing In...'}
              </span>
            ) : (
              <>
                {isRegister ? 'Create Account' : 'Sign In'}
                <ChevronRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          {!isRegister && (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ marginBottom: '12px' }}
              onClick={() => setForm({ ...form, email: 'admin@skylineairways.com', password: 'Admin@2024!' })}
            >
              Demo Login (Auto-Fill Credentials)
            </button>
          )}
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              setIsRegister(!isRegister);
              setForm({ name: '', email: '', password: '', role: 'viewer' });
            }}
          >
            {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar Navigation ─────────────────────────────────────────
const NAV_ITEMS = [
  { key: 'home', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'catalog', label: 'Data Catalog', icon: Database },
  { key: 'classification', label: 'Classification', icon: Shield },
  { key: 'quality', label: 'Data Quality', icon: Activity },
  { key: 'lineage', label: 'Data Lineage', icon: GitBranch },
  { key: 'metadata', label: 'Metadata', icon: FileText },
  { key: 'policies', label: 'Policies', icon: ScrollText },
  { key: 'stewardship', label: 'Stewardship', icon: Users },
  { key: 'compliance', label: 'Compliance', icon: CheckCircle },
  { key: 'access', label: 'Access Control', icon: Lock },
  { key: 'glossary', label: 'Glossary', icon: BookOpen },
  { key: 'audit', label: 'Audit Log', icon: ClipboardList },
  { key: 'ai', label: 'AI Assistant', icon: Bot },
  { key: 'ai-adv', label: 'Advanced AI', icon: Bot },
];

function Sidebar({ activeSection, onNavigate, collapsed, onToggle }) {
  const { user, logout } = useAuth();

  return (
    <>
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Plane size={24} />
            {!collapsed && <span className="sidebar-brand">SkyGov</span>}
          </div>
          <button className="sidebar-toggle" onClick={onToggle}>
            {collapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={`sidebar-nav-item ${activeSection === item.key ? 'active' : ''}`}
                onClick={() => onNavigate(item.key)}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={20} />
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && activeSection === item.key && (
                  <div className="nav-active-indicator" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && user && (
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">
                {(user.full_name || user.email || '?')[0].toUpperCase()}
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user.full_name || 'User'}</span>
                <span className="sidebar-user-role">{user.role || 'viewer'}</span>
              </div>
            </div>
          )}
          <button className="sidebar-nav-item logout-btn" onClick={logout} title="Logout">
            <LogOut size={20} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
      {!collapsed && <div className="sidebar-overlay" onClick={onToggle} />}
    </>
  );
}

// ─── Dashboard Layout ───────────────────────────────────────────
function DashboardLayout() {
  const [activeSection, setActiveSection] = useState('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleNavigate = useCallback((section) => {
    setActiveSection(section);
    if (window.innerWidth < 1024) {
      setSidebarCollapsed(true);
    }
  }, []);

  const renderSection = () => {
    const fallback = <div className="page-loading"><span className="spinner large" /></div>;
    switch (activeSection) {
      case 'home':
        return <React.Suspense fallback={fallback}><DashboardHome onNavigate={handleNavigate} /></React.Suspense>;
      case 'catalog':
        return <React.Suspense fallback={fallback}><CatalogPage /></React.Suspense>;
      case 'classification':
        return <React.Suspense fallback={fallback}><ClassificationPage /></React.Suspense>;
      case 'quality':
        return <React.Suspense fallback={fallback}><QualityPage /></React.Suspense>;
      case 'lineage':
        return <React.Suspense fallback={fallback}><LineagePage /></React.Suspense>;
      case 'metadata':
        return <React.Suspense fallback={fallback}><MetadataPage /></React.Suspense>;
      case 'policies':
        return <React.Suspense fallback={fallback}><PoliciesPage /></React.Suspense>;
      case 'stewardship':
        return <React.Suspense fallback={fallback}><StewardshipPage /></React.Suspense>;
      case 'compliance':
        return <React.Suspense fallback={fallback}><CompliancePage /></React.Suspense>;
      case 'access':
        return <React.Suspense fallback={fallback}><AccessControlPage /></React.Suspense>;
      case 'glossary':
        return <React.Suspense fallback={fallback}><GlossaryPage /></React.Suspense>;
      case 'audit':
        return <React.Suspense fallback={fallback}><AuditPage /></React.Suspense>;
      case 'ai':
        return <React.Suspense fallback={fallback}><AIAssistantPage /></React.Suspense>;
      case 'ai-adv':
        return <React.Suspense fallback={fallback}><AIAdvancedPage /></React.Suspense>;
      default:
        return <React.Suspense fallback={fallback}><DashboardHome /></React.Suspense>;
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className={`dashboard-main ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
        {renderSection()}
      </main>
    </div>
  );
}

// ─── App Root ───────────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </AuthProvider>
  );
}

export default App;
