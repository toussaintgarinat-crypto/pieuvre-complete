import { useState, useEffect } from 'react';
import api from '../utils/api';

export function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    email: '',
    telephone: '',
    adresse: '',
    code_postal: '',
    ville: '',
    gaines_refusees: [],
    section_prises_par_defaut: 1.5
  });

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      const data = await api.getClients();
      setClients(data.data || []);
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
        await api.updateClient(editing, formData);
      } else {
        await api.createClient(formData);
      }
      setShowForm(false);
      setEditing(null);
      resetForm();
      loadClients();
    } catch (err) {
      alert(err.message);
    }
  }

  function resetForm() {
    setFormData({
      nom: '',
      email: '',
      telephone: '',
      adresse: '',
      code_postal: '',
      ville: '',
      gaines_refusees: [],
      section_prises_par_defaut: 1.5
    });
  }

  function handleEdit(client) {
    setEditing(client.id);
    setFormData({
      nom: client.nom || '',
      email: client.email || '',
      telephone: client.telephone || '',
      adresse: client.adresse || '',
      code_postal: client.code_postal || '',
      ville: client.ville || '',
      gaines_refusees: client.gaines_refusees || [],
      section_prises_par_defaut: client.section_prises_par_defaut || 1.5
    });
    setShowForm(true);
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce client?')) return;
    try {
      await api.deleteClient(id);
      loadClients();
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

  const GAINES_AVAILABLE = [16, 20, 25, 32, 40];

  return (
    <div className="container">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1>Clients</h1>
          <p className="text-secondary mt-2">Gestion des clients avec leurs préférences NF C 15-100</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setEditing(null); setShowForm(true); }}>
          + Nouveau client
        </button>
      </div>

      {showForm && (
        <div className="card mb-4">
          <h3 className="card-title mb-4">{editing ? 'Modifier' : 'Nouveau'} client</h3>
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
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">Téléphone</label>
                <input
                  className="form-input"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Section prises par défaut</label>
                <select
                  className="form-select"
                  value={formData.section_prises_par_defaut}
                  onChange={(e) => setFormData({ ...formData, section_prises_par_defaut: parseFloat(e.target.value) })}
                >
                  <option value={1.5}>1.5 mm²</option>
                  <option value={2.5}>2.5 mm²</option>
                </select>
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
            <div className="grid grid-3">
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
              <div className="form-group">
                <label className="form-label">Gaines refusées</label>
                <select
                  className="form-select"
                  multiple
                  value={formData.gaines_refusees}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, (o) => parseInt(o.value));
                    setFormData({ ...formData, gaines_refusees: selected });
                  }}
                  style={{ height: '100px' }}
                >
                  {GAINES_AVAILABLE.map((g) => (
                    <option key={g} value={g}>Ø{g}mm</option>
                  ))}
                </select>
              </div>
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

      {clients.length > 0 ? (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Contact</th>
                  <th>Ville</th>
                  <th>Prises</th>
                  <th>Gaines refusées</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td className="mono">#{client.id}</td>
                    <td>
                      <div>{client.nom}</div>
                      <div className="text-sm text-muted">{client.email}</div>
                    </td>
                    <td>{client.ville || '-'}</td>
                    <td>
                      <span className="badge badge-neutral">
                        {client.section_prises_par_defaut || 1.5}mm²
                      </span>
                    </td>
                    <td>
                      {client.gaines_refusees?.length > 0 ? (
                        <span className="mono text-sm">
                          Ø{client.gaines_refusees.join(' Ø')}
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(client)}>
                          Éditer
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleDelete(client.id)}>
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
            <div className="empty-icon">👥</div>
            <div className="empty-title">Aucun client</div>
            <p>Créez votre premier client</p>
            <button className="btn btn-primary mt-4" onClick={() => setShowForm(true)}>
              + Nouveau client
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientsPage;