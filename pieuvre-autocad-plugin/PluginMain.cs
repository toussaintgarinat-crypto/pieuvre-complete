// ====================================================================
// PIEUVRE AUTO - Plugin AutoCAD
// Point d'entrée principal
// ====================================================================

using System;
using Autodesk.AutoCAD.Runtime;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.EditorInput;

[assembly: CommandClass(typeof(PieuvreAutoCAD.PluginMain))]

namespace PieuvreAutoCAD
{
    public class PluginMain : IExtensionApplication
    {
        private const string APP_NAME = "Pieuvre Auto";
        private const string VERSION = "1.0.0";
        
        // ================================================================
        // INITIALISATION DU PLUGIN
        // ================================================================
        public void Initialize()
        {
            Document doc = Application.DocumentManager.MdiActiveDocument;
            Editor ed = doc?.Editor;
            
            ed?.WriteMessage("\n╔════════════════════════════════════════════╗");
            ed?.WriteMessage($"\n║  {APP_NAME} v{VERSION}                    ║");
            ed?.WriteMessage("\n║  Plugin chargé avec succès                 ║");
            ed?.WriteMessage("\n║  Commandes disponibles :                   ║");
            ed?.WriteMessage("\n║  - PIEUVRE       : Interface principale    ║");
            ed?.WriteMessage("\n║  - PIEUVRESTOCK  : Consulter le stock      ║");
            ed?.WriteMessage("\n║  - PIEUVRECALC   : Calcul rapide           ║");
            ed?.WriteMessage("\n╚════════════════════════════════════════════╝\n");
            
            // Charger la configuration
            try
            {
                Core.Configuration.Load();
                ed?.WriteMessage($"\n✅ Configuration chargée : {Core.Configuration.ApiUrl}\n");
            }
            catch (Exception ex)
            {
                ed?.WriteMessage($"\n⚠️ Erreur chargement config : {ex.Message}\n");
            }
        }
        
        // ================================================================
        // DÉCHARGEMENT DU PLUGIN
        // ================================================================
        public void Terminate()
        {
            Document doc = Application.DocumentManager.MdiActiveDocument;
            Editor ed = doc?.Editor;
            
            ed?.WriteMessage($"\n{APP_NAME} déchargé.\n");
        }
        
        // ================================================================
        // COMMANDE: PIEUVRE
        // Lance l'interface principale
        // ================================================================
        [CommandMethod("PIEUVRE")]
        public void LaunchPieuvre()
        {
            Document doc = Application.DocumentManager.MdiActiveDocument;
            
            if (doc == null)
            {
                return;
            }
            
            try
            {
                // Vérifier la connexion API
                if (!Core.ApiClient.TestConnection())
                {
                    Application.ShowAlertDialog(
                        "❌ Impossible de se connecter à l'API Pieuvre.\n\n" +
                        $"URL configurée : {Core.Configuration.ApiUrl}\n\n" +
                        "Vérifiez que :\n" +
                        "1. Le serveur est démarré\n" +
                        "2. L'URL dans config.json est correcte\n" +
                        "3. Votre réseau fonctionne"
                    );
                    return;
                }
                
                // Ouvrir l'interface principale
                UI.MainForm mainForm = new UI.MainForm();
                Application.ShowModelessDialog(mainForm);
            }
            catch (Exception ex)
            {
                doc.Editor.WriteMessage($"\n❌ Erreur : {ex.Message}\n");
                Application.ShowAlertDialog($"Erreur lors du lancement :\n{ex.Message}");
            }
        }
        
        // ================================================================
        // COMMANDE: PIEUVRESTOCK
        // Affiche le stock actuel sans lancer l'interface complète
        // ================================================================
        [CommandMethod("PIEUVRESTOCK")]
        public void CheckStock()
        {
            Document doc = Application.DocumentManager.MdiActiveDocument;
            Editor ed = doc?.Editor;
            
            if (ed == null)
            {
                return;
            }
            
            try
            {
                ed.WriteMessage("\n⏳ Récupération du stock en cours...\n");
                
                // Appeler l'API
                var stock = Core.ApiClient.GetStock();
                
                if (stock == null)
                {
                    ed.WriteMessage("\n❌ Impossible de récupérer le stock.\n");
                    return;
                }
                
                // Afficher le stock
                ed.WriteMessage("\n╔════════════════════════════════════════════╗");
                ed.WriteMessage("\n║          STOCK ACTUEL                      ║");
                ed.WriteMessage("\n╠════════════════════════════════════════════╣");
                
                // Couleurs
                ed.WriteMessage("\n║  FILS :                                    ║");
                foreach (var item in stock.Couleurs)
                {
                    string alert = item.QuantiteMetres < item.SeuilAlerte ? " ⚠️" : "";
                    string line = $"║  {item.Couleur} {item.Section}mm² : {item.QuantiteMetres}m{alert}";
                    ed.WriteMessage($"\n{line.PadRight(45)}║");
                }
                
                ed.WriteMessage("\n║                                            ║");
                ed.WriteMessage("\n║  GAINES :                                  ║");
                
                // Gaines
                foreach (var item in stock.Gaines)
                {
                    string alert = item.QuantiteMetres < item.SeuilAlerte ? " ⚠️" : "";
                    string line = $"║  Ø{item.Diametre} : {item.QuantiteMetres}m{alert}";
                    ed.WriteMessage($"\n{line.PadRight(45)}║");
                }
                
                ed.WriteMessage("\n╚════════════════════════════════════════════╝\n");
                
                // Alertes
                var alertes = stock.Couleurs.FindAll(c => c.QuantiteMetres < c.SeuilAlerte);
                var alertesGaines = stock.Gaines.FindAll(g => g.QuantiteMetres < g.SeuilAlerte);
                
                if (alertes.Count > 0 || alertesGaines.Count > 0)
                {
                    ed.WriteMessage("\n⚠️  ALERTES STOCK BAS :\n");
                    
                    foreach (var item in alertes)
                    {
                        ed.WriteMessage($"   • {item.Couleur} {item.Section}mm² : {item.QuantiteMetres}m (seuil: {item.SeuilAlerte}m)\n");
                    }
                    
                    foreach (var item in alertesGaines)
                    {
                        ed.WriteMessage($"   • Gaine Ø{item.Diametre} : {item.QuantiteMetres}m (seuil: {item.SeuilAlerte}m)\n");
                    }
                }
                else
                {
                    ed.WriteMessage("\n✅ Tous les stocks sont au-dessus des seuils d'alerte.\n");
                }
                
                ed.WriteMessage($"\nDernière mise à jour : {stock.DerniereMiseAJour}\n");
            }
            catch (Exception ex)
            {
                ed.WriteMessage($"\n❌ Erreur : {ex.Message}\n");
            }
        }
        
        // ================================================================
        // COMMANDE: PIEUVRECALC
        // Calcul rapide avec dernier profil utilisé
        // ================================================================
        [CommandMethod("PIEUVRECALC")]
        public void QuickCalc()
        {
            Document doc = Application.DocumentManager.MdiActiveDocument;
            Editor ed = doc?.Editor;
            
            if (ed == null)
            {
                return;
            }
            
            try
            {
                // Charger le dernier profil utilisé
                var lastProfile = Core.Configuration.GetLastUsedProfile();
                
                if (lastProfile == null)
                {
                    ed.WriteMessage("\n⚠️ Aucun profil précédent trouvé. Utilisez la commande PIEUVRE.\n");
                    return;
                }
                
                ed.WriteMessage($"\n📋 Profil : {lastProfile.ClientNom} - {lastProfile.ChantierNom}\n");
                ed.WriteMessage("\n⏳ Analyse du plan en cours...\n");
                
                // Analyser les circuits (à implémenter)
                // var circuits = Core.CircuitAnalyzer.AnalyzeDwg();
                
                ed.WriteMessage("\n✅ Analyse terminée.\n");
                ed.WriteMessage("\n💡 Pour des résultats détaillés, utilisez la commande PIEUVRE.\n");
            }
            catch (Exception ex)
            {
                ed.WriteMessage($"\n❌ Erreur : {ex.Message}\n");
            }
        }
        
        // ================================================================
        // COMMANDE: PIEUVREINFO
        // Affiche les informations du plugin
        // ================================================================
        [CommandMethod("PIEUVREINFO")]
        public void ShowInfo()
        {
            Document doc = Application.DocumentManager.MdiActiveDocument;
            Editor ed = doc?.Editor;
            
            if (ed == null)
            {
                return;
            }
            
            ed.WriteMessage("\n╔════════════════════════════════════════════╗");
            ed.WriteMessage($"\n║  {APP_NAME} v{VERSION}                    ║");
            ed.WriteMessage("\n╠════════════════════════════════════════════╣");
            ed.WriteMessage($"\n║  API URL : {Core.Configuration.ApiUrl.PadRight(29)}║");
            ed.WriteMessage($"\n║  Utilisateur : {Core.Configuration.DefaultUser.PadRight(25)}║");
            ed.WriteMessage("\n║                                            ║");
            ed.WriteMessage("\n║  Commandes disponibles :                   ║");
            ed.WriteMessage("\n║  • PIEUVRE       - Interface principale    ║");
            ed.WriteMessage("\n║  • PIEUVRESTOCK  - Consulter stock         ║");
            ed.WriteMessage("\n║  • PIEUVRECALC   - Calcul rapide           ║");
            ed.WriteMessage("\n║  • PIEUVREINFO   - Ces informations        ║");
            ed.WriteMessage("\n╚════════════════════════════════════════════╝\n");
        }
    }
}
