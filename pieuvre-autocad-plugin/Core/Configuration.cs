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

        // Version d'AutoCAD détectée au runtime (définie par PluginMain.Initialize)
        public static string AutoCADDisplayVersion { get; internal set; } = "AutoCAD";
        public static string AutoCADVersionRaw { get; internal set; } = "";

        // Table de correspondance version interne → nom produit
        // ACADVER format: Major.Minor.Patch.Build
        // 2021=24.0, 2022=24.1, 2023=24.2, 2024=24.3, 2025=25.0
        private static readonly System.Collections.Generic.Dictionary<string, string> VERSION_NAMES =
            new System.Collections.Generic.Dictionary<string, string>
            {
                { "24.0", "AutoCAD 2021" },
                { "24.1", "AutoCAD 2022" },
                { "24.2", "AutoCAD 2023" },
                { "24.3", "AutoCAD 2024" },
                { "25.0", "AutoCAD 2025" },
            };

        public static void SetAutoCADVersion(string acadverRaw)
        {
            AutoCADVersionRaw = acadverRaw ?? "";
            AutoCADDisplayVersion = "AutoCAD";

            foreach (var entry in VERSION_NAMES)
            {
                if (AutoCADVersionRaw.StartsWith(entry.Key))
                {
                    AutoCADDisplayVersion = entry.Value;
                    return;
                }
            }

            // Version non reconnue : afficher le numéro brut
            if (!string.IsNullOrEmpty(AutoCADVersionRaw))
                AutoCADDisplayVersion = $"AutoCAD ({AutoCADVersionRaw})";
        }
        
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
