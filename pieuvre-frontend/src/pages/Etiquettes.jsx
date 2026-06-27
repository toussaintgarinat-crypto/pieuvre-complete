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

  const [calculs, setCalculs] = useState([]);
  const [genConfig, setGenConfig] = useState({
    calculId: '',
    configId: '',
    modeEtiquetage: 'atelier',
    ordre: ['logement', 'boite']
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [cfgData, calcData] = await Promise.all([
        api.getEtiquettesConfig(),
        api.getCalculs().catch(() => ({ data: [] }))
      ]);
      setConfigs(cfgData.data?.configurations || []);
      setTypesCircuits(cfgData.data?.types_circuit || []);
      setCalculs(calcData.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await api.createEtiquetteConfig(formData);
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
        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label">Calcul *</label>
            <select
              className="form-select"
              value={genConfig.calculId}
              onChange={(e) => setGenConfig({ ...genConfig, calculId: e.target.value })}
            >
              <option value="">Sélectionner un calcul...</option>
              {calculs.map(c => (
                <option key={c.id} value={c.id}>
                  #{c.id} - {c.chantier_nom} ({new Date(c.date_calcul).toLocaleDateString('fr-FR')})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Configuration</label>
            <select
              className="form-select"
              value={genConfig.configId}
              onChange={(e) => setGenConfig({ ...genConfig, configId: e.target.value })}
            >
              <option value="">Défaut</option>
              {configs.map(cfg => (
                <option key={cfg.id} value={cfg.id}>{cfg.nom}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label">Mode d'étiquetage</label>
            <select
              className="form-select"
              value={genConfig.modeEtiquetage}
              onChange={(e) => setGenConfig({ ...genConfig, modeEtiquetage: e.target.value })}
            >
              <option value="atelier">Atelier (par boîte)</option>
              <option value="machine">Machine (par type / section / gaine)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Ordre de regroupement</label>
            <select
              className="form-select"
              value={genConfig.ordre.join(',')}
              onChange={(e) => setGenConfig({ ...genConfig, ordre: e.target.value.split(',').filter(Boolean) })}
            >
              <option value="logement,boite">Logement → Boîte</option>
              <option value="boite,logement">Boîte → Logement</option>
              <option value="type,section,gaine">Type → Section → Gaine</option>
              <option value="gaine,type,section">Gaine → Type → Section</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            className="btn btn-primary"
            disabled={!genConfig.calculId}
            onClick={async () => {
              try {
                const blob = await api.generateEtiquette(
                  genConfig.calculId,
                  genConfig.configId || undefined,
                  genConfig.modeEtiquetage,
                  { ordre: genConfig.ordre }
                );
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `etiquettes_${genConfig.calculId}_${genConfig.modeEtiquetage}.pdf`;
                a.click();
                window.URL.revokeObjectURL(url);
              } catch (err) {
                alert(err.message);
              }
            }}
          >
            Télécharger PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export default EtiquettesPage;