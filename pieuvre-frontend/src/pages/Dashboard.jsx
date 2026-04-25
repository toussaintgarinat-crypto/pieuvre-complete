import { useState, useEffect } from 'react';
import api from '../utils/api';

export function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [calcData, clientData, chantData] = await Promise.all([
        api.getCalculs(),
        api.getClients(),
        api.getChantiers()
      ]);
      
      setStats({
        calculsTotal: calcData.data?.length || 0,
        clientsTotal: clientData.data?.length || 0,
        chantierstotal: chantData.data?.length || 0,
        derniersCalculs: calcData.data?.slice(-5).reverse() || []
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="grid grid-2 mb-4">
        <div>
          <h1>Dashboard</h1>
          <p className="text-secondary mt-2">Vue d'ensemble de vos projets</p>
        </div>
      </div>

      <div className="stats-grid stagger-children">
        <div className="stat-card">
          <div className="stat-value">{stats?.calculsTotal || 0}</div>
          <div className="stat-label">Calculs effectués</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.clientsTotal || 0}</div>
          <div className="stat-label">Clients</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.chantierstotal || 0}</div>
          <div className="stat-label">Chantiers actifs</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Derniers calculs</h3>
        </div>
        {stats?.derniersCalculs?.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Chantier</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stats.derniersCalculs.map((calc) => (
                  <tr key={calc.id}>
                    <td className="mono">#{calc.id}</td>
                    <td>{calc.chantier_nom || calc.id_chantier}</td>
                    <td className="mono">
                      {new Date(calc.date_calcul).toLocaleDateString('fr-FR')}
                    </td>
                    <td>
                      <span className={`badge ${calc.statut === 'termine' ? 'badge-success' : 'badge-neutral'}`}>
                        {calc.statut || 'en cours'}
                      </span>
                    </td>
                    <td>
                      <a href={`/calculs/${calc.id}`} className="btn btn-sm btn-secondary">
                        Voir
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <div className="empty-icon">⚡</div>
            <div className="empty-title">Aucun calcul</div>
            <p>Créez votre premier calcul pour commencer</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;