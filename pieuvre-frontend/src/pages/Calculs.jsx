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
    mode_production: '',
    mode_etiquetage: 'atelier',
    regroupement: { ordre: ['logement', 'boite'] }
  });

  const circuitVide = {
    type: 'P',
    longueur: 10,
    nb_points: 1,
    nb_prises: 1,
    etage: '',
    appartement: '',
    logement: '',
    numero_boite: 1
  };

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
      const payload = {
        id_chantier: parseInt(formData.id_chantier),
        utilisateur: formData.utilisateur || 'anonyme',
        circuits: formData.circuits,
        mode_production: formData.mode_production || undefined,
        mode_etiquetage: formData.mode_etiquetage,
        regroupement: formData.regroupement
      };

      // Calculer le bon de coupe
      const computed = await api.computeCalcul(payload);
      const bonDeCoupe = computed.data;

      // Sauvegarder
      const savePayload = {
        ...payload,
        bon_de_coupe: bonDeCoupe
      };

      if (editing) {
        await api.updateCalcul(editing, savePayload);
      } else {
        await api.createCalcul(savePayload);
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
      mode_production: '',
      mode_etiquetage: 'atelier',
      regroupement: { ordre: ['logement', 'boite'] }
    });
  }

  function handleEdit(calcul) {
    setEditing(calcul.id);
    setFormData({
      id_chantier: calcul.id_chantier,
      utilisateur: calcul.utilisateur || '',
      circuits: calcul.circuits || [],
      mode_production: calcul.mode_production || '',
      mode_etiquetage: calcul.mode_etiquetage || 'atelier',
      regroupement: calcul.regroupement || { ordre: ['logement', 'boite'] }
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

            <h4 className="mt-4 mb-2">Mode de production</h4>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Mode</label>
                <select
                  className="form-select"
                  value={formData.mode_production}
                  onChange={(e) => setFormData({ ...formData, mode_production: e.target.value })}
                >
                  <option value="">Défaut du chantier</option>
                  <option value="direct">Direct</option>
                  <option value="derivation">Alimentation + dérivation</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Mode d'étiquetage</label>
                <select
                  className="form-select"
                  value={formData.mode_etiquetage}
                  onChange={(e) => setFormData({ ...formData, mode_etiquetage: e.target.value })}
                >
                  <option value="atelier">Atelier (par boîte)</option>
                  <option value="machine">Machine (par type / section / gaine)</option>
                </select>
              </div>
            </div>

            <h4 className="mt-4 mb-2">Circuits</h4>
            {formData.circuits.map((circuit, index) => (
              <div key={index} className="card mb-2" style={{ padding: '1rem' }}>
                <div className="grid grid-5">
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select
                      className="form-select"
                      value={circuit.type}
                      onChange={(e) => {
                        const circuits = [...formData.circuits];
                        circuits[index].type = e.target.value;
                        setFormData({ ...formData, circuits });
                      }}
                    >
                      <option value="P">Prise (P)</option>
                      <option value="L">Lumière (L)</option>
                      <option value="VD">Va-et-vient (VD)</option>
                      <option value="DA">Double allumage (DA)</option>
                      <option value="TEL">Télérupteur (TEL)</option>
                      <option value="VR">Volet (VR)</option>
                      <option value="CUIS">Cuisinière (CUIS)</option>
                      <option value="VMC">VMC</option>
                      <option value="BS">Bloc secours (BS)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Longueur (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      value={circuit.longueur}
                      onChange={(e) => {
                        const circuits = [...formData.circuits];
                        circuits[index].longueur = parseFloat(e.target.value);
                        setFormData({ ...formData, circuits });
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Points</label>
                    <input
                      type="number"
                      className="form-input"
                      value={circuit.nb_points || circuit.nb_prises || 1}
                      onChange={(e) => {
                        const circuits = [...formData.circuits];
                        circuits[index].nb_points = parseInt(e.target.value);
                        circuits[index].nb_prises = parseInt(e.target.value);
                        setFormData({ ...formData, circuits });
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Logement</label>
                    <input
                      className="form-input"
                      value={circuit.logement || circuit.appartement || ''}
                      onChange={(e) => {
                        const circuits = [...formData.circuits];
                        circuits[index].logement = e.target.value;
                        circuits[index].appartement = e.target.value;
                        setFormData({ ...formData, circuits });
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Boîte</label>
                    <input
                      type="number"
                      className="form-input"
                      value={circuit.numero_boite || 1}
                      onChange={(e) => {
                        const circuits = [...formData.circuits];
                        circuits[index].numero_boite = parseInt(e.target.value);
                        setFormData({ ...formData, circuits });
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      const circuits = formData.circuits.filter((_, i) => i !== index);
                      setFormData({ ...formData, circuits });
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary mb-4"
              onClick={() => setFormData({ ...formData, circuits: [...formData.circuits, { ...circuitVide }] })}
            >
              + Ajouter un circuit
            </button>

            <div className="flex gap-2 mt-4">
              <button type="submit" className="btn btn-primary" disabled={formData.circuits.length === 0}>
                {editing ? 'Enregistrer' : 'Calculer et sauvegarder'}
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
                        <a href={`/etiquettes?calcul=${calc.id}`} className="btn btn-sm btn-secondary">
                          Étiquettes
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