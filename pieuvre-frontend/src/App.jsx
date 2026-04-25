import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ClientsPage } from './pages/Clients';
import { ChantiersPage } from './pages/Chantiers';
import { CalculsPage } from './pages/Calculs';
import { EtiquettesPage } from './pages/Etiquettes';
import { StockPage } from './pages/Stock';
import { DashboardPage } from './pages/Dashboard';
import { ConfigPage } from './pages/Config';
import { ScansPage } from './pages/Scans';

function NavLink({ to, children }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link to={to} className={`nav-link ${active ? 'active' : ''}`}>
      {children}
    </Link>
  );
}

function Layout({ children }) {
  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo">
            <span className="logo-icon">P</span>
            PIEUVRE
          </Link>
          <nav className="nav">
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/clients">Clients</NavLink>
            <NavLink to="/chantiers">Chantiers</NavLink>
            <NavLink to="/calculs">Calculs</NavLink>
            <NavLink to="/etiquettes">Étiquettes</NavLink>
            <NavLink to="/stock">Stock</NavLink>
            <NavLink to="/config">Config</NavLink>
            <NavLink to="/scans">Scan</NavLink>
          </nav>
        </div>
      </header>
      <main className="page">
        {children}
      </main>
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/chantiers" element={<ChantiersPage />} />
          <Route path="/calculs" element={<CalculsPage />} />
          <Route path="/etiquettes" element={<EtiquettesPage />} />
          <Route path="/stock" element={<StockPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/scans" element={<ScansPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;