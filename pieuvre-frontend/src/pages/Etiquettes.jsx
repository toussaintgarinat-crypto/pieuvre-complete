import { useState, useEffect } from 'react';
import api from '../utils/api';

export function EtiquettesPage() {
  const [configs, setConfigs] = useState([]);
  const [typesCircuits, setTypesCircuits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    largeur_mm: 70,
    hauteur_mm: 35,
    impressions_par_ligne: 3,
    est_defaut: false
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [cfgData, typesData] = await Promise.all([
        api.getEtiquettesConfig(),
        api.getEtiquettesConfig()
      ]);
      setConfigs(cfgData.configurations || []);
      setTypesCircuits(cfgData.types_circuit || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await api.createConfig(formData);
      setShowForm(false);
      resetForm();
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  function resetForm() {
    setFormData({
      nom: '',
      description: '',
      largeur_mm: 70,
      hauteur_mm: 35,
      impressions_par_ligne: 3,
      est_defaut: false
    });
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
          <h1>Étiquettes</h1>
          <p className="text-secondary mt-2">Configuration des étiquettes et génération PDF</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
          + Nouvelle config
        </button>
      </div>

      <div className="grid grid-2 mb-4">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Configurations</h3>
          </div>
          {configs.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Dimensions</th>
                    <th>Par ligne</th>
                    <th>Default</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((cfg) => (
                    <tr key={cfg.id}>
                      <td>{cfg.nom}</td>
                      <td className="mono">{cfg.largeur_mm}×{cfg.hauteur_mm}mm</td>
                      <td className="mono">{cfg.impressions_par_ligne}</td>
                      <td>
                        {cfg.est_defaut && <span className="badge badge-success">défaut</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">
              <p>Aucune configuration</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Types de circuits</h3>
          </div>
          <div className="grid grid-2" style={{ fontSize: '0.8125rem' }}>
            {typesCircuits.map((t) => (
              <div key={t.code} className="flex justify-between" style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                <span className="mono">{t.code}</span>
                <span>{t.libelle}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="card mb-4">
          <h3 className="card-title mb-4">Nouvelle configuration</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Nom *</label>
                <input
                  className="form-input"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  className="form-input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-3">
              <div className="form-group">
                <label className="form-label">Largeur (mm)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.largeur_mm}
                  onChange={(e) => setFormData({ ...formData, largeur_mm: parseFloat(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Hauteur (mm)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.hauteur_mm}
                  onChange={(e) => setFormData({ ...formData, hauteur_mm: parseFloat(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Par ligne</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.impressions_par_ligne}
                  onChange={(e) => setFormData({ ...formData, impressions_par_ligne: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="submit" className="btn btn-primary">Créer</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Générer des étiquettes</h3>
        </div>
        <p className="text-secondary mb-4">
          Pour générer des étiquettes, allez dans la page Calculs et cliquez sur "Étiquettes" 
          après avoir sélectionné un calcul.
        </p>
      </div>
    </div>
  );
}

export default EtiquettesPage;