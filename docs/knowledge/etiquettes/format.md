# Génération Étiquettes PDF

## Format par défaut

| Paramètre | Valeur |
|----------|-------|
| Dimensions | 70×35mm |
| Par ligne | 3 |
| Orientation | Paysage |
| Police titre | 10pt |
| Police corps | 8pt |
| Police pied | 7pt |

## Layout étiquette

```
┌───────────────────────────────────────┐
│ CHANTIER BtE Lg     📍           │ ← Ligne 1: localisation (droite)
├───────────────────────────────────────┤
│              P-1                      │ ← Ligne 2: nom gaine (centré)
├───────────────────────────────────────┤
│                    V/J 1.5mm²     │ ← Lignes 3-4: fils (droite)
├───────────────────────────────────────┤
│ P-1 | P-1 | P-1 | P-1           │ ← Ligne 5: nom 4× (centré)
├───────────────────────────────────────┤
│ CLIENT  15.2m/12.0m  ICTA 20  │ ← Ligne 6: info (gauche/cent/droite)
└───────────────────────────────────────┘
```

## Configurations disponibles

1. **Standard 70×35** - 3/ligne (défaut)
2. **Compact 50×25** - 4/ligne
3. **Grand 100×50** - 2/ligne
4. **Avery L7160** - 99×34mm

## Génération API

```bash
# Avec config par défaut
GET /api/etiquettes/generer/{calcul_id}

# Avec config spécifique
GET /api/etiquettes/generer/{calcul_id}?config_id=2
```

## Personnalisation client

Voir `client_symboles` pour mapper les codes de symboles par client.