# Pieuvre Auto - Base de Connaissances

Ce dossier contient toute la documentation et connaissances du système Pieuvre Auto.

## Structure

```
docs/
├── USAGE.md                    # Guide d'utilisation principal
├── MEMORY.md                   # ← Ce fichier (point d'entrée)
├── memory/
│   ├── QUICKREF.md             # Résumé rapide (commandes, URLs)
│   └── conversations/          # Historique conversations (futur)
├── api/
│   ├── endpoints.md            # Documentation API
│   └── errors.md               # Codes erreur
└── knowledge/                  # À développer
    └── normes/
```

## Nouvelles fonctionnalités (v1.1)

### Impression Ruban Continu

Système de gestion d'impression avec reprise après changement de rouleau.

| Table | Rôle |
|-------|------|
| `impression_sessions` | Session d'impression en cours |
| `impression_historique` | Traçabilité (qui a coupé quoi, quand) |

**Filtres disponibles :**
- `chantier` → Toutes les étiquettes
- `logement` → Un seul logement (Lg1, Lg2, etc.)
- `boite` → Une seule boîte (L-1, P-5, VR-7, etc.)

### TODO: Types de boîtes

> Différents types de boîtes existent selon le support (placo, béton, bois, etc.)
> À intégrer dans le module étiquetage.

**Types à prendre en compte :**
- Boîte placo (scelléement standard)
- Boîte béton (maçonnée)
- Boîte bois (maison ossature)
- Boîte extérieure (IP)

> Chaque type peut nécessiter un format d'étiquette différent.

## Docker

```bash
# PostgreSQL
docker start pieuvre-postgres
docker stop pieuvre-postgres

# Logs
docker logs pieuvre-postgres

# Connexion directe
docker exec -it pieuvre-postgres psql -U postgres -d pieuvre_db
```

## Fichiers de test

```
plans-test/                          # Plans et démos
├── *.dwg                            # Plans AutoCAD (AJBTP)
├── etiquettes-demo.html             # Démonstration visuelle
└── PIEUVRE_BON_COUPE_ETIQUETTES.pdf # PDF double exemplaire
```

## Maintenance

- Mettre à jour QUICKREF.md pour les commandes récentes
- Ajouter les nouveaux endpoints dans api/endpoints.md