# Types de Circuits - Référence

## Symboles normalisés

| Code | Nom | Catégorie | Section défaut |
|------|-----|-----------|-----------------|
| P | Prise 16A | prise | 1.5mm² |
| P20 | Prise 20A | prise | 2.5mm² |
| P_ETANCHE | Prise étanche | prise | 2.5mm² |
| P_PMR | Prise PMR | prise | 1.5mm² |
| L | Point lumineux | lumière | 1.5mm² |
| LUM | Luminaire | lumière | 1.5mm² |
| L_ENC | Luminaire encastré | lumière | 1.5mm² |
| I | Interrupteur | commande | 1.5mm² |
| VD | Va-et-vient | commande | 1.5mm² |
| DA | Double allumage | commande | 1.5mm² |
| TEL | Télérupteur | commande | 1.5mm² |
| RJ45 | Prise réseau | communication | 1.5mm² |
| TV | Prise antenne TV | communication | 1.5mm² |
| DI | Détecteur incendie | sécurité | 1.5mm² |
| BS | Bloc secours | sécurité | 1.5mm² |
| VMC | VMC | ventilation | 1.5mm² |
| CUIS | Cuisinière | appareil | 6mm² |
| LL | Lave-linge | appareil | 2.5mm² |
| LV | Lave-vaisselle | appareil | 2.5mm² |
| PG | Prise extérieure | extérieur | 2.5mm² |

## Calculs automatiques

### Nombre de circuits requis

```
nb_circuits = CEIL(nb_prises / 8)
```

### Diamètre gaine minimal

```javascript
// Surface cables
surface = cables.reduce((sum, c) => {
  diametre = getCableDiameter(c.section);
  return sum + Math.PI * Math.pow(diametre/2, 2);
});

// Surface gaine requise
gaine_surface = surface / 0.4;

// Diametre correspondant
diametre = 2 * Math.sqrt(gaine_surface / Math.PI);

// Choisir Ø disponible >= demande
return available_gaines.find(g => g >= diametre);
```

## Mapping client's

Chaque client peut avoir ses propres symboles. Voir `client_symboles` dans la base.