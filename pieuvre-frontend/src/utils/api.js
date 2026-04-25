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

  // Chantiers
  getChantiers: () => request('/chantiers'),
  getChantier: (id) => request(`/chantiers/${id}`),
  createChantier: (data) => request('/chantiers', { method: 'POST', body: data }),
  updateChantier: (id, data) => request(`/chantiers/${id}`, { method: 'PUT', body: data }),
  deleteChantier: (id) => request(`/chantiers/${id}`, { method: 'DELETE' }),

  // Calculs
  getCalculs: () => request('/calculs'),
  getCalcul: (id) => request(`/calculs/${id}`),
  createCalcul: (data) => request('/calculs', { method: 'POST', body: data }),
  updateCalcul: (id, data) => request(`/calculs/${id}`, { method: 'PUT', body: data }),
  deleteCalcul: (id) => request(`/calculs/${id}`, { method: 'DELETE' }),
  
  // Étiquettes
  getEtiquettesConfig: () => request('/etiquettes/config'),
  generateEtiquette: (calculId, configId) => 
    request(`/etitches/generer/${calculId}${configId ? `?config_id=${configId}` : ''}`),

  // Stock
  getStock: () => request('/stock'),
  updateStock: (id, data) => request(`/stock/${id}`, { method: 'PUT', body: data }),

  // Analytics
  getAnalytics: () => request('/analytics'),
};

export default api;