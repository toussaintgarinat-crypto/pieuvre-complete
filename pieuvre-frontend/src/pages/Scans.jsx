import { useState, useEffect } from 'react';
import api from '../utils/api';

export function ScansPage() {
  const [scans, setScans] = useState([]);
  const [symboles, setSymboles] = useState([]);
  const [clients, setClients] = useState([]);
  const [chantiers, setChantiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedScan, setSelectedScan] = useState(null);
  const [formData, setFormData] = useState({
    id_chantier: '',
    id_client: '',
    fichier: null
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [scansData, symbolesData, clientsData, chantiersData] = await Promise.all([
        fetch('/api/scans').then(r => r.json()),
        fetch('/api/scans/symboles').then(r => r.json()),
        fetch('/api/clients').then(r => r.json()),
        fetch('/api/chantiers').then(r => r.json())
      ]);
      setScans(scansData.data || []);
      setSymboles(symbolesData.data || []);
      setClients(clientsData.data || []);
      setChantiers(chantiersData.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!formData.fichier) return;
    
    setUploading(true);
    const data = new FormData();
    data.append('fichier', formData.fichier);
    if (formData.id_chantier) data.append('id_chantier', formData.id_chantier);
    if (formData.id_client) data.append('id_client', formData.id_client);
    
    try {
      const response = await fetch('/api/scans/upload', {
        method: 'POST',
        body: data
      });
      const result = await response.json();
      if (result.success) {
        loadData();
        alert('Fichier uploadé ! ID: ' + result.data.id);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleProcess(id) {
    setProcessing(true);
    try {
      const response = await fetch(`/api/scans/process/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ methode: 'local' })
      });
      const result = await response.json();
      if (result.success) {
        alert(`${result.data.nb_elements} éléments detectés, ${result.data.nb_circuits} circuits générés`);
        loadData();
        if (selectedScan === id) {
          loadScanResult(id);
        }
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function loadScanResult(id) {
    try {
      const response = await fetch(`/api/scans/${id}`);
      const result = await response.json();
      if (result.success) {
        setSelectedScan(result.data);
      }
    } catch (err) {
      console.error(err);
    }
  }

  const getClientName = (id) => {
    const client = clients.find(c => c.id === id);
    return client?.nom || `-`;
  };

  const getChantierName = (id) => {
    const ch = chantiers.find(c => c.id === id);
    return ch?.nom || `-`;
  };

  const getStatutBadge = (statut) => {
    const badges = {
      'en_attente': 'badge-warning',
      'en_cours': 'badge-neutral',
      'termine': 'badge-success',
      'erreur': 'badge-error'
    };
    return badges[statut] || 'badge-neutral';
  };

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
        <h1>Scan de Plans</h1>
        <p className="text-secondary mt-2">Importer et analyser des plans electriques</p>
      </div>

      <div className="grid grid-2 mb-4">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Importer un plan</h3>
          </div>
          <form onSubmit={handleUpload}>
            <div className="form-group">
              <label className="form-label">Chantier (optionnel)</label>
              <select
                className="form-select"
                value={formData.id_chantier}
                onChange={(e) => setFormData({ ...formData, id_chantier: e.target.value })}
              >
                <option value="">Aucun</option>
                {chantiers.map(ch => (
                  <option key={ch.id} value={ch.id}>{ch.nom}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Client (optionnel)</label>
              <select
                className="form-select"
                value={formData.id_client}
                onChange={(e) => setFormData({ ...formData, id_client: e.target.value })}
              >
                <option value="">Aucun</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Fichier *</label>
              <input
                type="file"
                className="form-input"
                accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.dwg,.dxf"
                onChange={(e) => setFormData({ ...formData, fichier: e.target.files[0] })}
              />
            </div>
            <div className="text-sm text-muted mb-4">
              Formats: PDF, PNG, JPG, TIFF, DWG, DXF (max 50MB)
            </div>
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              {uploading ? 'Upload...' : 'Importer'}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Symboles disponibles</h3>
          </div>
          <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Symbole</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Categorie</th>
                </tr>
              </thead>
              <tbody>
                {symboles.slice(0, 15).map((sym) => (
                  <tr key={sym.id}>
                    <td className="mono" style={{ fontSize: '1.25rem' }}>{sym.unicode_char || '○'}</td>
                    <td className="mono">{sym.code}</td>
                    <td>{sym.type_element}</td>
                    <td>{sym.categorie}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header">
          <h3 className="card-title">Historique des scans</h3>
        </div>
        {scans.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fichier</th>
                  <th>Type</th>
                  <th>Client</th>
                  <th>Chantier</th>
                  <th>Elements</th>
                  <th>Circuits</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {scans.map((scan) => (
                  <tr key={scan.id}>
                    <td className="mono">#{scan.id}</td>
                    <td className="mono" style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {scan.nom_fichier}
                    </td>
                    <td>
                      <span className="badge badge-neutral">{scan.type_fichier}</span>
                    </td>
                    <td>{getClientName(scan.id_client)}</td>
                    <td>{getChantierName(scan.id_chantier)}</td>
                    <td className="mono">{scan.nb_elements_detectes || 0}</td>
                    <td className="mono">{scan.nb_circuits_genérés || 0}</td>
                    <td>
                      <span className={`badge ${getStatutBadge(scan.statut)}`}>
                        {scan.statut}
                      </span>
                    </td>
                    <td className="mono text-sm">
                      {new Date(scan.scanned_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => { setSelectedScan(scan); loadScanResult(scan.id); }}
                        >
                          Voir
                        </button>
                        {scan.statut === 'en_attente' && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleProcess(scan.id)}
                            disabled={processing}
                          >
                            {processing ? '...' : 'Scanner'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <div className="empty-icon">📄</div>
            <div className="empty-title">Aucun scan</div>
            <p>Importez votre premier plan</p>
          </div>
        )}
      </div>

      {selectedScan && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              Resultat scan #{selectedScan.id}
            </h3>
            <button className="btn btn-sm btn-secondary" onClick={() => setSelectedScan(null)}>
              ✕
            </button>
          </div>
          
          <div className="grid grid-2">
            <div>
              <h4>Elements detectes</h4>
              {selectedScan.elements?.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Code</th>
                        <th>Confiance</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedScan.elements.map((el, idx) => (
                        <tr key={idx}>
                          <td>{el.type_element}</td>
                          <td className="mono">{el.code_symbol}</td>
                          <td className="mono">{(el.confiance * 100).toFixed(0)}%</td>
                          <td>{el.source_detection}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted">Aucun element</p>
              )}
            </div>
            <div>
              <h4>Circuits generes</h4>
              {selectedScan.circuits?.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Type</th>
                        <th>Nombre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedScan.circuits.map((circuit, idx) => (
                        <tr key={idx}>
                          <td className="mono">{circuit.code_circuit}</td>
                          <td>{circuit.type_element}</td>
                          <td className="mono">{circuit.nombre_elements}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted">Aucun circuit</p>
              )}
            </div>
          </div>
          
          {selectedScan.erreurs && (
            <div className="mt-4">
              <span className="badge badge-error">Erreur: {selectedScan.erreurs}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ScansPage;