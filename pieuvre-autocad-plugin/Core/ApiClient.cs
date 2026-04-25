// ====================================================================
// PIEUVRE AUTO - Client API
// Communication avec le backend Node.js
// ====================================================================

using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace PieuvreAutoCAD.Core
{
    public static class ApiClient
    {
        private static HttpClient _httpClient;
        private static string _baseUrl;
        
        static ApiClient()
        {
            _baseUrl = Configuration.ApiUrl;
            _httpClient = new HttpClient
            {
                BaseAddress = new Uri(_baseUrl),
                Timeout = TimeSpan.FromSeconds(30)
            };
        }
        
        // ================================================================
        // TEST DE CONNEXION
        // ================================================================
        public static bool TestConnection()
        {
            try
            {
                var response = _httpClient.GetAsync("/health").Result;
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }
        
        // ================================================================
        // CLIENTS
        // ================================================================
        
        public static Models.ClientsResponse GetClients()
        {
            try
            {
                var response = _httpClient.GetAsync("/api/clients").Result;
                
                if (!response.IsSuccessStatusCode)
                {
                    return null;
                }
                
                var json = response.Content.ReadAsStringAsync().Result;
                return JsonConvert.DeserializeObject<Models.ClientsResponse>(json);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erreur GetClients: {ex.Message}");
                return null;
            }
        }
        
        public static Models.Client GetClient(int id)
        {
            try
            {
                var response = _httpClient.GetAsync($"/api/clients/{id}").Result;
                
                if (!response.IsSuccessStatusCode)
                {
                    return null;
                }
                
                var json = response.Content.ReadAsStringAsync().Result;
                var apiResponse = JsonConvert.DeserializeObject<Models.ApiResponse<Models.Client>>(json);
                return apiResponse?.Data;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erreur GetClient: {ex.Message}");
                return null;
            }
        }
        
        public static Models.ClientsResponse SearchClients(string searchTerm)
        {
            try
            {
                var response = _httpClient.GetAsync($"/api/clients/search/{searchTerm}").Result;
                
                if (!response.IsSuccessStatusCode)
                {
                    return null;
                }
                
                var json = response.Content.ReadAsStringAsync().Result;
                return JsonConvert.DeserializeObject<Models.ClientsResponse>(json);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erreur SearchClients: {ex.Message}");
                return null;
            }
        }
        
        // ================================================================
        // CHANTIERS
        // ================================================================
        
        public static Models.ChantiersResponse GetChantiers(int? clientId = null, string statut = null)
        {
            try
            {
                string query = "";
                if (clientId.HasValue)
                {
                    query += $"?id_client={clientId}";
                }
                if (!string.IsNullOrEmpty(statut))
                {
                    query += query.Contains("?") ? $"&statut={statut}" : $"?statut={statut}";
                }
                
                var response = _httpClient.GetAsync($"/api/chantiers{query}").Result;
                
                if (!response.IsSuccessStatusCode)
                {
                    return null;
                }
                
                var json = response.Content.ReadAsStringAsync().Result;
                return JsonConvert.DeserializeObject<Models.ChantiersResponse>(json);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erreur GetChantiers: {ex.Message}");
                return null;
            }
        }
        
        public static Models.ChantierComplet GetChantier(int id)
        {
            try
            {
                var response = _httpClient.GetAsync($"/api/chantiers/{id}").Result;
                
                if (!response.IsSuccessStatusCode)
                {
                    return null;
                }
                
                var json = response.Content.ReadAsStringAsync().Result;
                var apiResponse = JsonConvert.DeserializeObject<Models.ApiResponse<Models.ChantierComplet>>(json);
                return apiResponse?.Data;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erreur GetChantier: {ex.Message}");
                return null;
            }
        }
        
        public static Models.Chantier CreateChantier(Models.ChantierCreate chantier)
        {
            try
            {
                var json = JsonConvert.SerializeObject(chantier);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                
                var response = _httpClient.PostAsync("/api/chantiers", content).Result;
                
                if (!response.IsSuccessStatusCode)
                {
                    return null;
                }
                
                var responseJson = response.Content.ReadAsStringAsync().Result;
                var apiResponse = JsonConvert.DeserializeObject<Models.ApiResponse<Models.Chantier>>(responseJson);
                return apiResponse?.Data;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erreur CreateChantier: {ex.Message}");
                return null;
            }
        }
        
        // ================================================================
        // STOCK
        // ================================================================
        
        public static Models.StockComplet GetStock()
        {
            try
            {
                // Récupérer couleurs
                var responseCouleurs = _httpClient.GetAsync("/api/stock/couleurs").Result;
                if (!responseCouleurs.IsSuccessStatusCode)
                {
                    return null;
                }
                
                var jsonCouleurs = responseCouleurs.Content.ReadAsStringAsync().Result;
                var couleurs = JsonConvert.DeserializeObject<Models.ApiResponse<Models.StockCouleur[]>>(jsonCouleurs);
                
                // Récupérer gaines
                var responseGaines = _httpClient.GetAsync("/api/stock/gaines").Result;
                if (!responseGaines.IsSuccessStatusCode)
                {
                    return null;
                }
                
                var jsonGaines = responseGaines.Content.ReadAsStringAsync().Result;
                var gaines = JsonConvert.DeserializeObject<Models.ApiResponse<Models.StockGaine[]>>(jsonGaines);
                
                return new Models.StockComplet
                {
                    Couleurs = new System.Collections.Generic.List<Models.StockCouleur>(couleurs.Data),
                    Gaines = new System.Collections.Generic.List<Models.StockGaine>(gaines.Data),
                    DerniereMiseAJour = DateTime.Now.ToString("dd/MM/yyyy HH:mm")
                };
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erreur GetStock: {ex.Message}");
                return null;
            }
        }
        
        public static Models.AlertesStockResponse GetAlertesStock()
        {
            try
            {
                var response = _httpClient.GetAsync("/api/stock/alertes").Result;
                
                if (!response.IsSuccessStatusCode)
                {
                    return null;
                }
                
                var json = response.Content.ReadAsStringAsync().Result;
                return JsonConvert.DeserializeObject<Models.AlertesStockResponse>(json);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erreur GetAlertesStock: {ex.Message}");
                return null;
            }
        }
        
        // ================================================================
        // CALCULS
        // ================================================================
        
        public static Models.Calcul SaveCalcul(Models.CalculCreate calcul)
        {
            try
            {
                var json = JsonConvert.SerializeObject(calcul);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                
                var response = _httpClient.PostAsync("/api/calculs", content).Result;
                
                if (!response.IsSuccessStatusCode)
                {
                    return null;
                }
                
                var responseJson = response.Content.ReadAsStringAsync().Result;
                var apiResponse = JsonConvert.DeserializeObject<Models.ApiResponse<Models.Calcul>>(responseJson);
                return apiResponse?.Data;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erreur SaveCalcul: {ex.Message}");
                return null;
            }
        }
        
        // ================================================================
        // CALCUL BON DE COUPE (sans sauvegarder)
        // ================================================================

        public static Models.BonDeCoupe ComputeBonDeCoupe(int chantierId, List<Models.CircuitInput> circuits)
        {
            try
            {
                var payload = new Models.ComputeRequest
                {
                    IdChantier = chantierId,
                    Circuits = circuits
                };

                var json = JsonConvert.SerializeObject(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = _httpClient.PostAsync("/api/calculs/compute", content).Result;

                if (!response.IsSuccessStatusCode)
                {
                    var error = response.Content.ReadAsStringAsync().Result;
                    System.Diagnostics.Debug.WriteLine($"Erreur compute: {error}");
                    return null;
                }

                var responseJson = response.Content.ReadAsStringAsync().Result;
                var apiResponse = JsonConvert.DeserializeObject<Models.ApiResponse<Models.BonDeCoupe>>(responseJson);
                return apiResponse?.Data;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erreur ComputeBonDeCoupe: {ex.Message}");
                return null;
            }
        }

        public static Models.CalculsResponse GetCalculsChantier(int chantierId, int limit = 50)
        {
            try
            {
                var response = _httpClient.GetAsync($"/api/calculs/chantier/{chantierId}?limit={limit}").Result;
                
                if (!response.IsSuccessStatusCode)
                {
                    return null;
                }
                
                var json = response.Content.ReadAsStringAsync().Result;
                return JsonConvert.DeserializeObject<Models.CalculsResponse>(json);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erreur GetCalculsChantier: {ex.Message}");
                return null;
            }
        }
    }
}
