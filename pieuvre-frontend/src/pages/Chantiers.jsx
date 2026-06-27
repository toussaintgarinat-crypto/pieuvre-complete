import { useState, useEffect } from 'react';
import api from '../utils/api';

export function ChantiersPage() {
  const [chantiers, setChantiers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    id_client: '',
    batiment: '',
    etage: '',
    appartement: '',
    adresse: '',
    code_postal: '',
    ville: '',
    notes: '',
    type_support: 'planchette',
    hauteur_plafond_m: 2.50,
    hauteur_prise_m: 0.30,
    hauteur_interrupteur_m: 1.10,
    besoin_pots: true,
    types_pots: ['boite_encastrement'],
    mode_production: 'direct',
    longueur_derivation_m: 2.50
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [chantiers_data, clients_data, analytics] = await Promise.all([
        api.getChantiers(),
        api.getClients(),
        api.getAnalytics().catch(() => ({ data: {} }))
      ]);
      setChantiers(chantiers_data.data || []);
      setClients(clients_data.data || []);
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
        await api.updateChantier(editing, formData);
      } else {
        await api.createChantier(formData);
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
      nom: '',
      id_client: '',
      batiment: '',
      etage: '',
      appartement: '',
      adresse: '',
      code_postal: '',
      ville: '',
      notes: '',
      type_support: 'planchette',
      hauteur_plafond_m: 2.50,
      hauteur_prise_m: 0.30,
      hauteur_interrupteur_m: 1.10,
      besoin_pots: true,
      types_pots: ['boite_encastrement'],
      mode_production: 'direct',
      longueur_derivation_m: 2.50
    });
  }

  function handleEdit(chantier) {
    setEditing(chantier.id);
    setFormData({
      nom: chantier.nom || '',
      id_client: chantier.id_client || '',
      batiment: chantier.batiment || '',
      etage: chantier.etage || '',
      appartement: chantier.appartement || '',
      adresse: chantier.adresse || '',
      code_postal: chantier.code_postal || '',
      ville: chantier.ville || '',
      notes: chantier.notes || '',
      type_support: chantier.type_support || 'planchette',
      hauteur_plafond_m: chantier.hauteur_plafond_m ?? 2.50,
      hauteur_prise_m: chantier.hauteur_prise_m ?? 0.30,
      hauteur_interrupteur_m: chantier.hauteur_interrupteur_m ?? 1.10,
      besoin_pots: chantier.besoin_pots ?? true,
      types_pots: Array.isArray(chantier.types_pots) ? chantier.types_pots : ['boite_encastrement'],
      mode_production: chantier.mode_production || 'direct',
      longueur_derivation_m: chantier.longueur_derivation_m ?? 2.50
    });
    setShowForm(true);
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce chantier?')) return;
    try {
      await api.deleteChantier(id);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  function getClientName(id) {
    const client = clients.find(c => c.id === id);
    return client?.nom || `#${id}`;
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
          <h1>Chantiers</h1>
          <p className="text-secondary mt-2">Gestion des chantiers et lots</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setEditing(null); setShowForm(true); }}>
          + Nouveau chantier
        </button>
      </div>

      {showForm && (
        <div className="card mb-4">
          <h3 className="card-title mb-4">{editing ? 'Modifier' : 'Nouveau'} chantier</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Nom du chantier *</label>
                <input
                  className="form-input"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Client *</label>
                <select
                  className="form-select"
                  value={formData.id_client}
                  onChange={(e) => setFormData({ ...formData, id_client: e.target.value })}
                  required
                >
                  <option value="">Sélectionner...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.nom}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-3">
              <div className="form-group">
                <label className="form-label">Bâtiment</label>
                <input
                  className="form-input"
                  value={formData.batiment}
                  onChange={(e) => setFormData({ ...formData, batiment: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Étage</label>
                <input
                  className="form-input"
                  value={formData.etage}
                  onChange={(e) => setFormData({ ...formData, etage: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Lot/Appartement</label>
                <input
                  className="form-input"
                  value={formData.appartement}
                  onChange={(e) => setFormData({ ...formData, appartement: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Adresse</label>
              <input
                className="form-input"
                value={formData.adresse}
                onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
              />
            </div>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Code postal</label>
                <input
                  className="form-input"
                  value={formData.code_postal}
                  onChange={(e) => setFormData({ ...formData, code_postal: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Ville</label>
                <input
                  className="form-input"
                  value={formData.ville}
                  onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                />
              </div>
            </div>

            <h4 className="mt-4 mb-2">Configuration installation</h4>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Mode de production</label>
                <select
                  className="form-select"
                  value={formData.mode_production}
                  onChange={(e) => setFormData({ ...formData, mode_production: e.target.value })}
                >
                  <option value="direct">Direct (tableau → appareil)</option>
                  <option value="derivation">Alimentation + dérivation</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Longueur dérivation (m)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.longueur_derivation_m}
                  onChange={(e) => setFormData({ ...formData, longueur_derivation_m: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Type de support</label>
                <select
                  className="form-select"
                  value={formData.type_support}
                  onChange={(e) => setFormData({ ...formData, type_support: e.target.value })}
                >
                  <option value="planchette">Planchette / Faux-plafond</option>
                  <option value="dalle_plein">Dalle plein</option>
                  <option value="mixte">Mixte</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Hauteur sous plafond (m)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.hauteur_plafond_m}
                  onChange={(e) => setFormData({ ...formData, hauteur_plafond_m: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Hauteur prise (m)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.hauteur_prise_m}
                  onChange={(e) => setFormData({ ...formData, hauteur_prise_m: parseFloat(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Hauteur interrupteur (m)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.hauteur_interrupteur_m}
                  onChange={(e) => setFormData({ ...formData, hauteur_interrupteur_m: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label flex gap-2 items-center">
                <input
                  type="checkbox"
                  checked={formData.besoin_pots}
                  onChange={(e) => setFormData({ ...formData, besoin_pots: e.target.checked })}
                />
                Besoin en pots / boîtiers
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-textarea"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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

      {chantiers.length > 0 ? (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Chantier</th>
                  <th>Client</th>
                  <th>Localisation</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {chantiers.map((chantier) => (
                  <tr key={chantier.id}>
                    <td className="mono">#{chantier.id}</td>
                    <td>
                      <div>{chantier.nom}</div>
                      {chantier.batiment && (
                        <div className="text-sm text-muted">
                          Bt{chantier.batiment} · E{chantier.etage || '-'} · Lg{chantier.appartement || '-'}
                        </div>
                      )}
                    </td>
                    <td>{getClientName(chantier.id_client)}</td>
                    <td className="mono text-sm">{chantier.code_postal} {chantier.ville}</td>
                    <td>
                      <span className={`badge ${chantier.statut === 'actif' ? 'badge-success' : 'badge-neutral'}`}>
                        {chantier.statut || 'inactif'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(chantier)}>
                          Éditer
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleDelete(chantier.id)}>
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
            <div className="empty-icon">🏗️</div>
            <div className="empty-title">Aucun chantier</div>
            <p>Créez votre premier chantier</p>
            <button className="btn btn-primary mt-4" onClick={() => setShowForm(true)}>
              + Nouveau chantier
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChantiersPage;