// ====================================================================
// PIEUVRE AUTO - Configuration
// ====================================================================

using System;
using System.IO;
using Newtonsoft.Json;

namespace PieuvreAutoCAD.Core
{
    public static class Configuration
    {
        private const string CONFIG_FILE = @"C:\PieuvreAutoCAD\config.json";
        private const string PROFILES_FILE = @"C:\PieuvreAutoCAD\last_profiles.json";
        
        public static string ApiUrl { get; private set; }
        public static string DefaultUser { get; private set; }
        
        // ================================================================
        // MODÈLE DE CONFIGURATION
        // ================================================================
        private class ConfigModel
        {
            public string api_url { get; set; }
            public string default_user { get; set; }
        }
        
        // ================================================================
        // CHARGER LA CONFIGURATION
        // ================================================================
        public static void Load()
        {
            try
            {
                // Créer le répertoire si nécessaire
                string configDir = Path.GetDirectoryName(CONFIG_FILE);
                if (!Directory.Exists(configDir))
                {
                    Directory.CreateDirectory(configDir);
                }
                
                // Si le fichier n'existe pas, créer un fichier par défaut
                if (!File.Exists(CONFIG_FILE))
                {
                    CreateDefaultConfig();
                }
                
                // Lire le fichier
                string json = File.ReadAllText(CONFIG_FILE);
                var config = JsonConvert.DeserializeObject<ConfigModel>(json);
                
                ApiUrl = config.api_url ?? "http://localhost:3001";
                DefaultUser = config.default_user ?? Environment.UserName;
            }
            catch (Exception ex)
            {
                // Fallback sur valeurs par défaut
                ApiUrl = "http://localhost:3001";
                DefaultUser = Environment.UserName;
                
                System.Diagnostics.Debug.WriteLine($"Erreur chargement config: {ex.Message}");
            }
        }
        
        // ================================================================
        // CRÉER CONFIGURATION PAR DÉFAUT
        // ================================================================
        private static void CreateDefaultConfig()
        {
            var defaultConfig = new ConfigModel
            {
                api_url = "http://localhost:3001",
                default_user = Environment.UserName
            };
            
            string json = JsonConvert.SerializeObject(defaultConfig, Formatting.Indented);
            File.WriteAllText(CONFIG_FILE, json);
        }
        
        // ================================================================
        // SAUVEGARDER LE DERNIER PROFIL UTILISÉ
        // ================================================================
        public static void SaveLastUsedProfile(Models.ProfilUtilise profil)
        {
            try
            {
                string json = JsonConvert.SerializeObject(profil, Formatting.Indented);
                File.WriteAllText(PROFILES_FILE, json);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erreur sauvegarde profil: {ex.Message}");
            }
        }
        
        // ================================================================
        // RÉCUPÉRER LE DERNIER PROFIL UTILISÉ
        // ================================================================
        public static Models.ProfilUtilise GetLastUsedProfile()
        {
            try
            {
                if (!File.Exists(PROFILES_FILE))
                {
                    return null;
                }
                
                string json = File.ReadAllText(PROFILES_FILE);
                return JsonConvert.DeserializeObject<Models.ProfilUtilise>(json);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erreur chargement profil: {ex.Message}");
                return null;
            }
        }
    }
}
