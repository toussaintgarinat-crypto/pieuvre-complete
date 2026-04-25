import { useState, useEffect } from 'react';
import api from '../utils/api';

export function CalculsPage() {
  const [calculs, setCalculs] = useState([]);
  const [chantiers, setChantiers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    id_chantier: '',
    utilisateur: '',
    circuits: [],
    marge: 0.15
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [calc_data, chant_data, client_data] = await Promise.all([
        api.getCalculs(),
        api.getChantiers(),
        api.getClients()
      ]);
      setCalculs(calc_data.data || []);
      setChantiers(chant_data.data || []);
      setClients(client_data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateCalcul(editing, formData);
      } else {
        await api.createCalcul(formData);
      }
      setShowForm(false);
      setEditing(null);
      resetForm();
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  function resetForm() {
    setFormData({
      id_chantier: '',
      utilisateur: '',
      circuits: [],
      marge: 0.15
    });
  }

  function handleEdit(calcul) {
    setEditing(calcul.id);
    setFormData({
      id_chantier: calcul.id_chantier,
      utilisateur: calcul.utilisateur || '',
      circuits: calcul.circuits || [],
      marge: calcul.marge || 0.15
    });
    setShowForm(true);
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce calcul?')) return;
    try {
      await api.deleteCalcul(id);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  function getChantierNom(id) {
    const ch = chantiers.find(c => c.id === id);
    return ch?.nom || `#${id}`;
  }

  function getClientNom(id) {
    const ch = chantiers.find(c => c.id === id);
    if (!ch) return '-';
    const cl = clients.find(c => c.id === ch.id_client);
    return cl?.nom || '-';
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
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1>Calculs</h1>
          <p className="text-secondary mt-2">Calculs de dimensionnement des gaines</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setEditing(null); setShowForm(true); }}>
          + Nouveau calcul
        </button>
      </div>

      {showForm && (
        <div className="card mb-4">
          <h3 className="card-title mb-4">{editing ? 'Modifier' : 'Nouveau'} calcul</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Chantier *</label>
                <select
                  className="form-select"
                  value={formData.id_chantier}
                  onChange={(e) => setFormData({ ...formData, id_chantier: e.target.value })}
                  required
                >
                  <option value="">Sélectionner...</option>
                  {chantiers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nom} - {getClientNom(c.id)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Utilisateur</label>
                <input
                  className="form-input"
                  value={formData.utilisateur}
                  onChange={(e) => setFormData({ ...formData, utilisateur: e.target.value })}
                  placeholder="Nom de l'utilisateur"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Marge de sécurité (%)</label>
              <input
                type="number"
                className="form-input"
                value={formData.marge * 100}
                onChange={(e) => setFormData({ ...formData, marge: parseInt(e.target.value) / 100 })}
                min="0"
                max="50"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button type="submit" className="btn btn-primary">
                {editing ? 'Enregistrer' : 'Créer'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {calculs.length > 0 ? (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Chantier</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {calculs.map((calc) => (
                  <tr key={calc.id}>
                    <td className="mono">#{calc.id}</td>
                    <td>{getChantierNom(calc.id_chantier)}</td>
                    <td>{getClientNom(calc.id_chantier)}</td>
                    <td className="mono">
                      {new Date(calc.date_calcul).toLocaleDateString('fr-FR')}
                    </td>
                    <td>
                      <span className={`badge ${calc.statut === 'termine' ? 'badge-success' : 'badge-neutral'}`}>
                        {calc.statut || 'en cours'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <a href={`/calculs/${calc.id}`} className="btn btn-sm btn-secondary">
                          Voir
                        </a>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(calc)}>
                          Éditer
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleDelete(calc.id)}>
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">⚡</div>
            <div className="empty-title">Aucun calcul</div>
            <p>Créez votre premier calcul</p>
            <button className="btn btn-primary mt-4" onClick={() => setShowForm(true)}>
              + Nouveau calcul
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CalculsPage;