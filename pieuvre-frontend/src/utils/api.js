const API_URL = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'ErreurAPI');
  }

  return data;
}

export const api = {
  // Clients
  getClients: () => request('/clients'),
  getClient: (id) => request(`/clients/${id}`),
  createClient: (data) => request('/clients', { method: 'POST', body: data }),
  updateClient: (id, data) => request(`/clients/${id}`, { method: 'PUT', body: data }),
  deleteClient: (id) => request(`/clients/${id}`, { method: 'DELETE' }),
  getClientPreferences: (id) => request(`/clients/${id}/preferences`),
  updateClientPreferences: (id, data) => request(`/clients/${id}/preferences`, { method: 'PUT', body: data }),

  // Chantiers
  getChantiers: () => request('/chantiers'),
  getChantier: (id) => request(`/chantiers/${id}`),
  createChantier: (data) => request('/chantiers', { method: 'POST', body: data }),
  updateChantier: (id, data) => request(`/chantiers/${id}`, { method: 'PUT', body: data }),
  deleteChantier: (id) => request(`/chantiers/${id}`, { method: 'DELETE' }),
  getChantierPreferences: (id) => request(`/chantiers/${id}/preferences`),
  updateChantierPreferences: (id, data) => request(`/chantiers/${id}/preferences`, { method: 'PUT', body: data }),

  // Calculs
  getCalculs: () => request('/calculs'),
  getCalcul: (id) => request(`/calculs/${id}`),
  createCalcul: (data) => request('/calculs', { method: 'POST', body: data }),
  updateCalcul: (id, data) => request(`/calculs/${id}`, { method: 'PUT', body: data }),
  deleteCalcul: (id) => request(`/calculs/${id}`, { method: 'DELETE' }),
  computeCalcul: (data) => request('/calculs/compute', { method: 'POST', body: data }),

  // Étiquettes
  getEtiquettesConfig: () => request('/etiquettes/config'),
  createEtiquetteConfig: (data) => request('/etiquettes/config', { method: 'POST', body: data }),
  generateEtiquette: (calculId, configId, modeEtiquetage, regroupement) => {
    let url = `/etiquettes/generer/${calculId}?`;
    const params = new URLSearchParams();
    if (configId) params.set('config_id', configId);
    if (modeEtiquetage) params.set('mode_etiquetage', modeEtiquetage);
    if (regroupement) params.set('regroupement', JSON.stringify(regroupement));
    url += params.toString();
    return fetch(`${API_URL}${url}`).then(r => {
      if (!r.ok) throw new Error('Erreur génération PDF');
      return r.blob();
    });
  },

  // Impression ruban continu
  getImpressionSessions: () => request('/impression/sessions'),
  getImpressionSession: (id) => request(`/impression/sessions/${id}`),
  createImpressionSession: (data) => request('/impression/sessions', { method: 'POST', body: data }),
  markImpression: (id, data) => request(`/impression/sessions/${id}/marquer`, { method: 'PUT', body: data }),
  cancelImpression: (id) => request(`/impression/sessions/${id}/annuler`, { method: 'PUT' }),
  getImpressionEtiquettes: (id, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/impression/calcul/${id}/etiquettes${qs ? `?${qs}` : ''}`);
  },

  // OCR Mappings (mémoire client/dossier)
  getOcrMappings: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/ocr-mappings${qs ? `?${qs}` : ''}`);
  },
  createOcrMapping: (data) => request('/ocr-mappings', { method: 'POST', body: data }),
  updateOcrMapping: (id, data) => request(`/ocr-mappings/${id}`, { method: 'PUT', body: data }),
  deleteOcrMapping: (id) => request(`/ocr-mappings/${id}`, { method: 'DELETE' }),
  duplicateOcrMappings: (data) => request('/ocr-mappings/duplicate', { method: 'POST', body: data }),
  previewOcrMappings: (data) => request('/ocr-mappings/preview', { method: 'POST', body: data }),
  getCircuitTypes: () => request('/ocr-mappings/types-circuits'),

  // Stock
  getStock: () => request('/stock'),
  updateStock: (id, data) => request(`/stock/${id}`, { method: 'PUT', body: data }),

  // Analytics
  getAnalytics: () => request('/analytics'),
};

export default api;