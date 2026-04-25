import { useState, useEffect } from 'react';
import api from '../utils/api';

export function ConfigPage() {
  const [normes, setNormes] = useState([]);
  const [parametres, setParametres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [normesData, paramsData] = await Promise.all([
        fetch('/api/normes').then(r => r.json()),
        fetch('/api/parametres').then(r => r.json())
      ]);
      setNormes(normesData.data || []);
      setParametres(paramsData.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(nom) {
    try {
      await fetch(`/api/normes/${nom}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valeur: editValue })
      });
      setEditing(null);
      loadData();
    } catch (err) {
      alert(err.message);
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
        <h1>Configuration</h1>
        <p className="text-secondary mt-2">Normes et paramètres système</p>
      </div>

      <div className="grid grid-2 mb-4">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Normes NF C 15-100</h3>
          </div>
          <p className="text-sm text-secondary mb-4">
            Paramètres normatifs - modifiables sans code
          </p>
          {normes.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Paramètre</th>
                    <th>Valeur</th>
                    <th>Unité</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {normes.map((n) => (
                    <tr key={n.id}>
                      <td>
                        <div className="mono">{n.nom}</div>
                        <div className="text-sm text-muted">{n.description}</div>
                      </td>
                      <td>
                        {editing === n.nom ? (
                          <input
                            className="form-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            style={{ width: '80px' }}
                          />
                        ) : (
                          <span className="mono">{n.valeur}</span>
                        )}
                      </td>
                      <td className="mono text-muted">{n.unite || '-'}</td>
                      <td>
                        {editing === n.nom ? (
                          <div className="flex gap-1">
                            <button className="btn btn-sm btn-primary" onClick={() => handleSave(n.nom)}>
                              ✓
                            </button>
                            <button className="btn btn-sm btn-secondary" onClick={() => setEditing(null)}>
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => { setEditing(n.nom); setEditValue(n.valeur); }}
                          >
                            Éditer
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              <p>Aucune norme</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Paramètres</h3>
          </div>
          <p className="text-sm text-secondary mb-4">
            Configuration générale de l'application
          </p>
          {parametres.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Clé</th>
                    <th>Valeur</th>
                    <th>Catégorie</th>
                  </tr>
                </thead>
                <tbody>
                  {parametres.map((p) => (
                    <tr key={p.id}>
                      <td className="mono">{p.cle}</td>
                      <td className="mono">{p.valeur}</td>
                      <td>
                        <span className="badge badge-neutral">{p.categorie}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              <p>Aucun paramètre</p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">À propos</h3>
        </div>
        <p className="text-secondary">
          Ces paramètres stockent les normes NF C 15-100 et la configuration système.
          Pour mettre à jour les normes après un changement normatif, modifiez simplement
          les valeurs ici - aucun changement de code requis.
        </p>
      </div>
    </div>
  );
}

export default ConfigPage;