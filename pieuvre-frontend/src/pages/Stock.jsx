import { useState, useEffect } from 'react';
import api from '../utils/api';

export function StockPage() {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStock();
  }, []);

  async function loadStock() {
    try {
      const data = await api.getStock();
      setStock(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading"><div className="spinner"></div></div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="mb-4">
        <h1>Stock</h1>
        <p className="text-secondary mt-2">Gestion du stock de cables et gaines</p>
      </div>

      <div className="stats-grid mb-4">
        <div className="stat-card">
          <div className="stat-value">{stock.length}</div>
          <div className="stat-label">Références</div>
        </div>
      </div>

      {stock.length > 0 ? (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Type</th>
                  <th>Section</th>
                  <th>Stock</th>
                  <th>Unité</th>
                  <th>Seuil</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((item) => (
                  <tr key={item.id}>
                    <td className="mono">{item.reference}</td>
                    <td>{item.type}</td>
                    <td className="mono">{item.section}mm²</td>
                    <td>
                      <span className={`badge ${item.quantite > item.seuil_alerte ? 'badge-success' : 'badge-warning'}`}>
                        {item.quantite}
                      </span>
                    </td>
                    <td>{item.unite}</td>
                    <td className="mono">{item.seuil_alerte}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">📦</div>
            <div className="empty-title">Stock vide</div>
            <p>Ajoutez des références dans la base de données</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default StockPage;