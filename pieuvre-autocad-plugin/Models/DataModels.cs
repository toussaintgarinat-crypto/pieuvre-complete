// ====================================================================
// PIEUVRE AUTO - Modèles de données
// ====================================================================

using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace PieuvreAutoCAD.Models
{
    // ================================================================
    // RÉPONSES API GÉNÉRIQUES
    // ================================================================
    
    public class ApiResponse<T>
    {
        [JsonProperty("success")]
        public bool Success { get; set; }
        
        [JsonProperty("data")]
        public T Data { get; set; }
        
        [JsonProperty("error")]
        public string Error { get; set; }
    }
    
    // ================================================================
    // CLIENTS
    // ================================================================
    
    public class Client
    {
        [JsonProperty("id")]
        public int Id { get; set; }
        
        [JsonProperty("nom")]
        public string Nom { get; set; }
        
        [JsonProperty("prises_section")]
        public decimal PrisesSection { get; set; }
        
        [JsonProperty("eclairage_section")]
        public decimal EclairageSection { get; set; }
        
        [JsonProperty("volets_section")]
        public decimal VoletsSection { get; set; }
        
        [JsonProperty("cuisson_section")]
        public decimal CuissonSection { get; set; }
        
        [JsonProperty("couleurs_preferees")]
        public List<string> CouleursPreferees { get; set; }
        
        [JsonProperty("particularites")]
        public string Particularites { get; set; }
        
        public override string ToString()
        {
            return Nom;
        }
    }
    
    public class ClientsResponse
    {
        [JsonProperty("success")]
        public bool Success { get; set; }
        
        [JsonProperty("count")]
        public int Count { get; set; }
        
        [JsonProperty("data")]
        public List<Client> Data { get; set; }
    }
    
    // ================================================================
    // CHANTIERS
    // ================================================================
    
    public class Chantier
    {
        [JsonProperty("id")]
        public int Id { get; set; }
        
        [JsonProperty("id_client")]
        public int IdClient { get; set; }
        
        [JsonProperty("nom")]
        public string Nom { get; set; }
        
        [JsonProperty("adresse")]
        public string Adresse { get; set; }
        
        [JsonProperty("statut")]
        public string Statut { get; set; }
        
        [JsonProperty("client_nom")]
        public string ClientNom { get; set; }
        
        public override string ToString()
        {
            return Nom;
        }
    }
    
    public class ChantierComplet
    {
        [JsonProperty("id")]
        public int Id { get; set; }
        
        [JsonProperty("nom")]
        public string Nom { get; set; }
        
        [JsonProperty("client_nom")]
        public string ClientNom { get; set; }
        
        [JsonProperty("couleurs_preferees")]
        public List<string> CouleursPreferees { get; set; }
        
        [JsonProperty("profil")]
        public ProfilChantier Profil { get; set; }
    }
    
    public class ProfilChantier
    {
        [JsonProperty("prises_section")]
        public decimal PrisesSection { get; set; }
        
        [JsonProperty("eclairage_section")]
        public decimal EclairageSection { get; set; }
        
        [JsonProperty("volets_section")]
        public decimal VoletsSection { get; set; }
        
        [JsonProperty("cuisson_section")]
        public decimal CuissonSection { get; set; }
    }
    
    public class ChantiersResponse
    {
        [JsonProperty("success")]
        public bool Success { get; set; }
        
        [JsonProperty("count")]
        public int Count { get; set; }
        
        [JsonProperty("data")]
        public List<Chantier> Data { get; set; }
    }
    
    public class ChantierCreate
    {
        [JsonProperty("id_client")]
        public int IdClient { get; set; }
        
        [JsonProperty("nom")]
        public string Nom { get; set; }
        
        [JsonProperty("adresse")]
        public string Adresse { get; set; }
        
        [JsonProperty("prises_section")]
        public decimal? PrisesSection { get; set; }
        
        [JsonProperty("eclairage_section")]
        public decimal? EclairageSection { get; set; }
    }
    
    // ================================================================
    // STOCK
    // ================================================================
    
    public class StockCouleur
    {
        [JsonProperty("id")]
        public int Id { get; set; }
        
        [JsonProperty("couleur")]
        public string Couleur { get; set; }
        
        [JsonProperty("section")]
        public decimal Section { get; set; }
        
        [JsonProperty("quantite_metres")]
        public int QuantiteMetres { get; set; }
        
        [JsonProperty("seuil_alerte")]
        public int SeuilAlerte { get; set; }
        
        [JsonProperty("updated_at")]
        public DateTime UpdatedAt { get; set; }
    }
    
    public class StockGaine
    {
        [JsonProperty("id")]
        public int Id { get; set; }
        
        [JsonProperty("diametre")]
        public int Diametre { get; set; }
        
        [JsonProperty("quantite_metres")]
        public int QuantiteMetres { get; set; }
        
        [JsonProperty("seuil_alerte")]
        public int SeuilAlerte { get; set; }
        
        [JsonProperty("updated_at")]
        public DateTime UpdatedAt { get; set; }
    }
    
    public class StockComplet
    {
        public List<StockCouleur> Couleurs { get; set; }
        public List<StockGaine> Gaines { get; set; }
        public string DerniereMiseAJour { get; set; }
    }
    
    public class AlerteStock
    {
        [JsonProperty("type")]
        public string Type { get; set; }
        
        [JsonProperty("designation")]
        public string Designation { get; set; }
        
        [JsonProperty("stock_actuel")]
        public int StockActuel { get; set; }
        
        [JsonProperty("seuil_alerte")]
        public int SeuilAlerte { get; set; }
    }
    
    public class AlertesStockResponse
    {
        [JsonProperty("success")]
        public bool Success { get; set; }
        
        [JsonProperty("count")]
        public int Count { get; set; }
        
        [JsonProperty("data")]
        public List<AlerteStock> Data { get; set; }
    }
    
    // ================================================================
    // CALCULS
    // ================================================================
    
    public class BonDeCoupe
    {
        [JsonProperty("fils")]
        public List<LigneFil> Fils { get; set; }
        
        [JsonProperty("gaines")]
        public List<LigneGaine> Gaines { get; set; }
        
        [JsonProperty("circuits")]
        public List<CircuitDetail> Circuits { get; set; }
        
        [JsonProperty("substitutions")]
        public Dictionary<string, string> Substitutions { get; set; }
        
        [JsonProperty("alertes")]
        public List<Alerte> Alertes { get; set; }
        
        [JsonProperty("stats")]
        public StatsCalcul Stats { get; set; }
    }
    
    public class LigneFil
    {
        [JsonProperty("couleur")]
        public string Couleur { get; set; }
        
        [JsonProperty("section")]
        public decimal Section { get; set; }
        
        [JsonProperty("longueur")]
        public decimal Longueur { get; set; }
        
        [JsonProperty("fonction")]
        public string Fonction { get; set; }
        
        [JsonProperty("substituee")]
        public bool? Substituee { get; set; }
        
        [JsonProperty("couleur_originale")]
        public string CouleurOriginale { get; set; }
    }
    
    public class LigneGaine
    {
        [JsonProperty("diametre")]
        public int Diametre { get; set; }
        
        [JsonProperty("longueur")]
        public decimal Longueur { get; set; }
    }
    
    public class CircuitDetail
    {
        [JsonProperty("id")]
        public string Id { get; set; }
        
        [JsonProperty("type")]
        public string Type { get; set; }
        
        [JsonProperty("longueur")]
        public decimal Longueur { get; set; }
    }
    
    public class Alerte
    {
        [JsonProperty("type")]
        public string Type { get; set; }
        
        [JsonProperty("message")]
        public string Message { get; set; }
        
        [JsonProperty("severite")]
        public string Severite { get; set; }
    }
    
    public class StatsCalcul
    {
        [JsonProperty("longueur_totale_fils")]
        public decimal LongueurTotaleFils { get; set; }
        
        [JsonProperty("longueur_totale_gaines")]
        public decimal LongueurTotaleGaines { get; set; }
        
        [JsonProperty("nb_substitutions")]
        public int NbSubstitutions { get; set; }
    }
    
    public class Calcul
    {
        [JsonProperty("id")]
        public int Id { get; set; }
        
        [JsonProperty("id_chantier")]
        public int IdChantier { get; set; }
        
        [JsonProperty("utilisateur")]
        public string Utilisateur { get; set; }
        
        [JsonProperty("date_calcul")]
        public DateTime DateCalcul { get; set; }
        
        [JsonProperty("bon_de_coupe")]
        public BonDeCoupe BonDeCoupe { get; set; }
        
        [JsonProperty("commentaire")]
        public string Commentaire { get; set; }
    }
    
    public class CalculCreate
    {
        [JsonProperty("id_chantier")]
        public int IdChantier { get; set; }
        
        [JsonProperty("utilisateur")]
        public string Utilisateur { get; set; }
        
        [JsonProperty("bon_de_coupe")]
        public BonDeCoupe BonDeCoupe { get; set; }
        
        [JsonProperty("fichier_dwg_path")]
        public string FichierDwgPath { get; set; }
        
        [JsonProperty("commentaire")]
        public string Commentaire { get; set; }
    }
    
    public class CalculsResponse
    {
        [JsonProperty("success")]
        public bool Success { get; set; }
        
        [JsonProperty("count")]
        public int Count { get; set; }
        
        [JsonProperty("data")]
        public List<Calcul> Data { get; set; }
    }
    
    // ================================================================
    // CIRCUIT (INPUT SIMPLIFIÉ POUR CALCUL)
    // ================================================================

    public class CircuitInput
    {
        [JsonProperty("id")]
        public string Id { get; set; }

        [JsonProperty("type")]
        public string Type { get; set; }

        [JsonProperty("longueur")]
        public decimal Longueur { get; set; }

        [JsonProperty("description")]
        public string Description { get; set; }
    }

    public class ComputeRequest
    {
        [JsonProperty("id_chantier")]
        public int IdChantier { get; set; }

        [JsonProperty("circuits")]
        public List<CircuitInput> Circuits { get; set; }
    }

    // ================================================================
    // PROFIL UTILISÉ
    // ================================================================
    
    public class ProfilUtilise
    {
        public int ClientId { get; set; }
        public string ClientNom { get; set; }
        public int? ChantierId { get; set; }
        public string ChantierNom { get; set; }
        public DateTime DerniereUtilisation { get; set; }
    }
}
