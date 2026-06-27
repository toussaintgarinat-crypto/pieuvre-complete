import { useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';

const DEFAULT_PREFS = {
  mode_etiquetage: 'atelier',
  config_id: '',
  regroupement: { ordre: ['logement', 'boite'] }
};

export function MemoireClientPage() {
  const [clients, setClients] = useState([]);
  const [chantiers, setChantiers] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedChantier, setSelectedChantier] = useState('');
  const [scope, setScope] = useState('client'); // 'client' ou 'chantier'

  const [mappings, setMappings] = useState([]);
  const [circuitTypes, setCircuitTypes] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [memoireActive, setMemoireActive] = useState(false);

  const [form, setForm] = useState({
    ocr_type_element: '',
    ocr_code_symbol: '',
    circuit_type_code: '',
    description: '',
    priority: 100,
    conditions: '{}'
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const [previewDevices, setPreviewDevices] = useState([
    { type_element: 'prise', code_symbol: 'P16' },
    { type_element: 'lumiere', code_symbol: 'L' },
    { type_element: 'interrupteur', code_symbol: 'VD' }
  ]);
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    api.getClients().then(r => setClients(r.data));
    api.getCircuitTypes().then(r => setCircuitTypes(r.data));
    api.getEtiquettesConfig().then(r => setConfigs(r.data.configurations || []));
  }, []);

  useEffect(() => {
    if (!selectedClient) {
      setChantiers([]);
      return;
    }
    api.getChantiers().then(r => {
      setChantiers(r.data.filter(ch => String(ch.id_client) === String(selectedClient)));
    });
  }, [selectedClient]);

  const loadData = async () => {
    if (!selectedClient) return;
    setLoading(true);
    try {
      const params = { id_client: selectedClient };
      if (scope === 'chantier' && selectedChantier) {
        params.id_chantier = selectedChantier;
      }
      const [mRes, cPrefs, chPrefs] = await Promise.all([
        api.getOcrMappings(params),
        api.getClientPreferences(selectedClient),
        selectedChantier ? api.getChantierPreferences(selectedChantier) : Promise.resolve({ data: {} })
      ]);
      setMappings(mRes.data || []);

      const base = cPrefs.data?.preferences_etiquettes || {};
      const override = chPrefs.data?.preferences_etiquettes || {};
      const merged = {
        mode_etiquetage: override.mode_etiquetage || base.mode_etiquetage || DEFAULT_PREFS.mode_etiquetage,
        config_id: override.config_id || base.config_id || DEFAULT_PREFS.config_id,
        regroupement: override.regroupement || base.regroupement || DEFAULT_PREFS.regroupement
      };
      setPrefs(merged);
      setMemoireActive(
        scope === 'chantier'
          ? chPrefs.data?.memoire_ocr_active || false
          : cPrefs.data?.memoire_ocr_active || false
      );
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient, selectedChantier, scope]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleCreateMapping = async (e) => {
    e.preventDefault();
    if (!form.circuit_type_code) return;
    try {
      const payload = {
        ...form,
        conditions: form.conditions ? JSON.parse(form.conditions) : {}
      };
      if (scope === 'client') {
        payload.id_client = parseInt(selectedClient);
      } else if (scope === 'chantier') {
        payload.id_chantier = parseInt(selectedChantier);
      }
      await api.createOcrMapping(payload);
      showMessage('Mapping enregistré');
      setForm({ ...form, ocr_type_element: '', ocr_code_symbol: '', description: '', conditions: '{}' });
      loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const handleDeleteMapping = async (id) => {
    if (!window.confirm('Supprimer ce mapping ?')) return;
    try {
      await api.deleteOcrMapping(id);
      showMessage('Mapping supprimé');
      loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const handleSavePreferences = async () => {
    try {
      const payload = {
        preferences_etiquettes: prefs,
        memoire_ocr_active: memoireActive
      };
      if (scope === 'client') {
        await api.updateClientPreferences(selectedClient, payload);
      } else {
        await api.updateChantierPreferences(selectedChantier, payload);
      }
      showMessage('Préférences enregistrées');
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const handleDuplicateMappings = async () => {
    if (!selectedClient || !selectedChantier) return;
    if (!window.confirm('Copier tous les mappings du client vers ce chantier ?')) return;
    try {
      await api.duplicateOcrMappings({
        id_client: parseInt(selectedClient, 10),
        id_chantier: parseInt(selectedChantier, 10)
      });
      showMessage('Mappings client copiés vers le chantier');
      loadData();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const handlePreview = async () => {
    if (!selectedClient) return;
    setPreviewLoading(true);
    try {
      const res = await api.previewOcrMappings({
        devices: previewDevices,
        context: {
          id_client: parseInt(selectedClient, 10),
          id_chantier: scope === 'chantier' && selectedChantier ? parseInt(selectedChantier, 10) : null
        }
      });
      setPreviewResult(res.data);
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const scopeLabel = useMemo(() => {
    if (scope === 'chantier') {
      const ch = chantiers.find(c => String(c.id) === String(selectedChantier));
      return `Chantier : ${ch?.nom || selectedChantier}`;
    }
    const cl = clients.find(c => String(c.id) === String(selectedClient));
    return `Client : ${cl?.nom || selectedClient}`;
  }, [scope, selectedChantier, selectedClient, chantiers, clients]);

  return (
    <div className="page-memoire">
      <h1>Mémoire client / dossier</h1>
      <p className="subtitle">
        Personnalisez les symboles OCR et les préférences d&apos;étiquetage par client et par chantier.
        L&apos;héritage suit : dossier &gt; client &gt; global.
      </p>

      {message && (
        <div className={`alert ${message.type}`}>{message.text}</div>
      )}

      <div className="card selectors">
        <label>
          Client
          <select value={selectedClient} onChange={e => {
            setSelectedClient(e.target.value);
            setSelectedChantier('');
          }}>
            <option value="">-- Choisir un client --</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </label>

        <label>
          Portée
          <select value={scope} onChange={e => setScope(e.target.value)} disabled={!selectedClient}>
            <option value="client">Tous les chantiers du client</option>
            <option value="chantier" disabled={!selectedChantier}>Un chantier spécifique</option>
          </select>
        </label>

        <label>
          Chantier (optionnel)
          <select value={selectedChantier} onChange={e => {
            setSelectedChantier(e.target.value);
            if (e.target.value) setScope('chantier');
          }} disabled={!selectedClient}>
            <option value="">-- Choisir un chantier --</option>
            {chantiers.map(ch => (
              <option key={ch.id} value={ch.id}>{ch.nom}</option>
            ))}
          </select>
        </label>
      </div>

      {!selectedClient ? (
        <div className="card">Sélectionnez un client pour commencer.</div>
      ) : (
        <>
          <section className="card">
            <h2>Préférences d&apos;étiquetage — {scopeLabel}</h2>
            <div className="form-grid">
              <label>
                Mode d&apos;étiquetage par défaut
                <select
                  value={prefs.mode_etiquetage}
                  onChange={e => setPrefs({ ...prefs, mode_etiquetage: e.target.value })}
                >
                  <option value="atelier">Atelier (par boîte)</option>
                  <option value="machine">Machine (par type/section/gaine)</option>
                </select>
              </label>

              <label>
                Format d&apos;étiquette par défaut
                <select
                  value={prefs.config_id || ''}
                  onChange={e => setPrefs({ ...prefs, config_id: e.target.value ? parseInt(e.target.value) : null })}
                >
                  <option value="">-- Config par défaut --</option>
                  {configs.map(cfg => (
                    <option key={cfg.id} value={cfg.id}>{cfg.nom} ({cfg.largeur_mm}×{cfg.hauteur_mm}mm)</option>
                  ))}
                </select>
              </label>

              <label>
                Ordre de regroupement (JSON)
                <input
                  type="text"
                  value={JSON.stringify(prefs.regroupement)}
                  onChange={e => {
                    try {
                      setPrefs({ ...prefs, regroupement: JSON.parse(e.target.value) });
                    } catch { /* ignore */ }
                  }}
                />
              </label>
            </div>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={memoireActive}
                onChange={e => setMemoireActive(e.target.checked)}
              />
              Activer la mémoire OCR personnalisée pour {scope === 'chantier' ? 'ce chantier' : 'ce client'}
            </label>

            <button className="btn-primary" onClick={handleSavePreferences} disabled={loading}>
              Enregistrer les préférences
            </button>
          </section>

          <section className="card">
            <div className="section-header">
              <h2>Mappings OCR — {scopeLabel}</h2>
              {scope === 'chantier' && selectedChantier && (
                <button className="btn-secondary" onClick={handleDuplicateMappings}>
                  Copier les mappings client vers ce chantier
                </button>
              )}
            </div>
            {loading ? (
              <p>Chargement…</p>
            ) : mappings.length === 0 ? (
              <p>Aucun mapping personnalisé. Les règles globales s&apos;appliquent.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Type OCR</th>
                    <th>Code OCR</th>
                    <th>Circuit</th>
                    <th>Description</th>
                    <th>Priorité</th>
                    <th>Origine</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map(m => {
                    const origin = m.id_chantier ? 'chantier' : m.id_client ? 'client' : 'global';
                    return (
                      <tr key={m.id}>
                        <td>{m.ocr_type_element || '*'}</td>
                        <td>{m.ocr_code_symbol || '*'}</td>
                        <td>{m.circuit_type_code} — {m.circuit_libelle}</td>
                        <td>{m.description}</td>
                        <td>{m.priority}</td>
                        <td>
                          <span className={`badge badge-${origin}`}>
                            {origin === 'chantier' ? 'Chantier' : origin === 'client' ? 'Client' : 'Global'}
                          </span>
                        </td>
                        <td>
                          {m.id_client || m.id_chantier ? (
                            <button className="btn-danger" onClick={() => handleDeleteMapping(m.id)}>
                              Supprimer
                            </button>
                          ) : (
                            <span className="muted">Global</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <h2>Ajouter un mapping personnalisé</h2>
            <form onSubmit={handleCreateMapping} className="form-grid">
              <label>
                Type OCR (ex: prise)
                <input
                  value={form.ocr_type_element}
                  onChange={e => setForm({ ...form, ocr_type_element: e.target.value })}
                  placeholder="prise"
                />
              </label>
              <label>
                Code OCR (ex: P16)
                <input
                  value={form.ocr_code_symbol}
                  onChange={e => setForm({ ...form, ocr_code_symbol: e.target.value })}
                  placeholder="P16"
                />
              </label>
              <label>
                Type de circuit Pieuvre *
                <select
                  value={form.circuit_type_code}
                  onChange={e => setForm({ ...form, circuit_type_code: e.target.value })}
                  required
                >
                  <option value="">-- Choisir --</option>
                  {circuitTypes.map(t => (
                    <option key={t.code} value={t.code}>{t.code} — {t.libelle}</option>
                  ))}
                </select>
              </label>
              <label>
                Priorité
                <input
                  type="number"
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                />
              </label>
              <label className="full">
                Description
                <input
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Prise 16A spécifique au client"
                />
              </label>
              <label className="full">
                Conditions (JSON)
                <input
                  value={form.conditions}
                  onChange={e => setForm({ ...form, conditions: e.target.value })}
                  placeholder='{"requires_code":true}'
                />
              </label>
              <div className="full">
                <button className="btn-primary" type="submit">
                  Ajouter le mapping
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <h2>Prévisualisation OCR</h2>
            <p className="muted">
              Simulez des dispositifs détectés pour vérifier que les mappings du client/chantier s&apos;appliquent.
            </p>
            <div className="preview-devices">
              {previewDevices.map((device, idx) => (
                <div key={idx} className="preview-device">
                  <input
                    placeholder="type"
                    value={device.type_element}
                    onChange={e => {
                      const next = [...previewDevices];
                      next[idx].type_element = e.target.value;
                      setPreviewDevices(next);
                    }}
                  />
                  <input
                    placeholder="code"
                    value={device.code_symbol}
                    onChange={e => {
                      const next = [...previewDevices];
                      next[idx].code_symbol = e.target.value;
                      setPreviewDevices(next);
                    }}
                  />
                  <button
                    className="btn-danger btn-small"
                    onClick={() => setPreviewDevices(previewDevices.filter((_, i) => i !== idx))}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                className="btn-secondary btn-small"
                onClick={() => setPreviewDevices([...previewDevices, { type_element: '', code_symbol: '' }])}
              >
                + Ajouter un dispositif
              </button>
            </div>
            <button
              className="btn-primary"
              onClick={handlePreview}
              disabled={previewLoading || !selectedClient}
            >
              {previewLoading ? 'Analyse…' : 'Prévisualiser la résolution'}
            </button>
            {previewResult && (
              <div className="preview-result">
                <strong>Type de circuit résolu :</strong>
                <span className="badge badge-primary">{previewResult.type_resolu || 'Aucun'}</span>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default MemoireClientPage;
