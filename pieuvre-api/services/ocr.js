// ====================================================================
// PIEUVRE API - Service OCR / Vision
// Extraction de dispositifs électriques depuis images, PDF et plans CAD
// ====================================================================

const fs = require('fs');
const path = require('path');

const VISION_PROVIDER = process.env.VISION_PROVIDER || 'openai';
const VISION_API_KEY = process.env.VISION_API_KEY;
const VISION_MODEL = process.env.VISION_MODEL || 'gpt-4o-mini';
const VISION_API_BASE = process.env.VISION_API_BASE;
const VISION_MOCK_MODE = process.env.VISION_MOCK_MODE === 'true';
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_BASE = process.env.OPENROUTER_API_BASE || 'https://openrouter.ai/api/v1';
const OPENROUTER_SITE_URL = process.env.OPENROUTER_SITE_URL || 'http://localhost';
const OPENROUTER_APP_NAME = process.env.OPENROUTER_APP_NAME || 'Pieuvre Auto';

const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.gif', '.webp', '.bmp'];

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans la lecture de plans électriques.
Analyse l'image fournie et identifie tous les dispositifs électriques (prises, points lumineux, interrupteurs, volets, VMC, détecteurs, etc.).

Pour chaque dispositif détecté, retourne un objet JSON avec :
- type_element: type du dispositif (prise, lumiere, interrupteur, communication, securite, ventilation, appareil, exterieur)
- code_symbol: code du symbole (P, L, VD, DA, TEL, BS, VMC, VR, CUIS, LL, LV, PG, etc.)
- position_x: position X estimée en pixels ou unité relative (0-1000)
- position_y: position Y estimée en pixels ou unité relative (0-1000)
- label: texte ou référence lu sur le plan (ex: "P1", "L2", "Cuisine")
- confiance: score entre 0 et 1

Retourne UNIQUEMENT un objet JSON au format :
{
  "dispositifs": [
    { "type_element": "...", "code_symbol": "...", "position_x": 123, "position_y": 456, "label": "...", "confiance": 0.95 }
  ],
  "notes": "observations éventuelles"
}

Si aucun dispositif n'est détecté, retourne {"dispositifs": [], "notes": "Aucun dispositif détecté"}.`;

/**
 * Détecte les dispositifs depuis une image.
 */
async function detectFromImage(filePath) {
  if (OCR_SERVICE_URL) {
    return callOCRService('image', filePath);
  }

  if (VISION_MOCK_MODE) {
    return generateMockDetection(filePath, 'image');
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
    throw new Error(`Format image non supporté: ${ext}`);
  }

  const base64 = fs.readFileSync(filePath).toString('base64');
  const mimeType = getMimeType(ext);
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const raw = await callVisionAPI(dataUrl);
  return parseVisionResponse(raw);
}

/**
 * Détecte les dispositifs depuis un PDF.
 * Stratégie : extraction de texte + appel vision si possible.
 */
async function detectFromPDF(filePath) {
  if (OCR_SERVICE_URL) {
    return callOCRService('pdf', filePath);
  }

  if (VISION_MOCK_MODE) {
    return generateMockDetection(filePath, 'pdf');
  }

  let textContent = '';
  try {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(buffer);
    textContent = pdfData.text || '';
  } catch (err) {
    console.warn('Extraction PDF texte échouée:', err.message);
  }

  // Si le PDF contient du texte exploitable, on l'analyse via LLM texte
  if (textContent.trim().length > 20) {
    const raw = await callTextAnalysisAPI(textContent);
    return parseVisionResponse(raw);
  }

  // Sinon, on retourne une détection vide
  return { dispositifs: [], notes: 'PDF sans texte exploitable ou vision non configurée' };
}

/**
 * Détecte les dispositifs depuis un fichier CAD (DWG/DXF).
 * Stratégie : extraction de texte brut (limité) + fallback.
 */
async function detectFromCAD(filePath) {
  if (OCR_SERVICE_URL) {
    return callOCRService('cad', filePath);
  }

  if (VISION_MOCK_MODE) {
    return generateMockDetection(filePath, 'cad');
  }

  let textContent = '';
  try {
    const buffer = fs.readFileSync(filePath);
    // Extraction naïve de chaînes de caractères ASCII/UTF-8
    textContent = extractStrings(buffer);
  } catch (err) {
    console.warn('Lecture CAD échouée:', err.message);
  }

  if (textContent.trim().length > 10) {
    const raw = await callTextAnalysisAPI(textContent);
    return parseVisionResponse(raw);
  }

  return { dispositifs: [], notes: 'Fichier CAD lu mais aucun texte exploitable' };
}

/**
 * Extrait les chaînes de caractères lisibles d'un buffer binaire.
 */
function extractStrings(buffer) {
  const minLength = 4;
  const strings = [];
  let current = '';

  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    if (byte >= 32 && byte <= 126) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= minLength) {
        strings.push(current);
      }
      current = '';
    }
  }

  if (current.length >= minLength) {
    strings.push(current);
  }

  return strings.join('\n').substring(0, 5000);
}

/**
 * Appelle l'API vision selon le fournisseur configuré.
 */
async function callOCRService(endpoint, filePath) {
  const response = await fetch(`${OCR_SERVICE_URL}/detect/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur OCR service (${endpoint}): ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.data || { dispositifs: [], notes: 'Réponse vide du service OCR' };
}

async function callVisionAPI(imageDataUrl) {
  if (VISION_PROVIDER === 'openrouter') {
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY manquant. Définissez la clé ou activez VISION_MOCK_MODE=true.');
    }
    return callOpenRouterVision(imageDataUrl);
  }

  if (!VISION_API_KEY) {
    throw new Error('VISION_API_KEY manquant. Définissez la clé ou activez VISION_MOCK_MODE=true.');
  }

  switch (VISION_PROVIDER) {
    case 'openai':
      return callOpenAIVision(imageDataUrl);
    case 'anthropic':
      return callAnthropicVision(imageDataUrl);
    case 'google':
      return callGoogleVision(imageDataUrl);
    default:
      throw new Error(`Fournisseur vision non supporté: ${VISION_PROVIDER}`);
  }
}

/**
 * Analyse texte (pour PDF/CAD) sans image.
 */
async function callTextAnalysisAPI(text) {
  if (VISION_MOCK_MODE) {
    return JSON.stringify({ dispositifs: [], notes: 'Mode mock texte' });
  }

  const prompt = `${SYSTEM_PROMPT}\n\nVoici le texte extrait d'un plan électrique. Identifie les dispositifs et leurs positions approximatives si possible.\n\n---\n${text.substring(0, 8000)}\n---`;

  if (VISION_PROVIDER === 'openrouter') {
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY manquant.');
    }
    return callOpenRouterText(prompt);
  }

  if (!VISION_API_KEY) {
    throw new Error('VISION_API_KEY manquant.');
  }

  switch (VISION_PROVIDER) {
    case 'openai':
      return callOpenAIText(prompt);
    case 'anthropic':
      return callAnthropicText(prompt);
    case 'google':
      return callGoogleText(prompt);
    default:
      throw new Error(`Fournisseur vision non supporté: ${VISION_PROVIDER}`);
  }
}

// ====================================================================
// OPENAI
// ====================================================================
async function callOpenAIVision(imageDataUrl) {
  const baseUrl = VISION_API_BASE || 'https://api.openai.com/v1';
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VISION_API_KEY}`
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyse ce plan électrique et retourne les dispositifs détectés au format JSON demandé.' },
            { type: 'image_url', image_url: { url: imageDataUrl } }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur OpenAI vision: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callOpenAIText(prompt) {
  const baseUrl = VISION_API_BASE || 'https://api.openai.com/v1';
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VISION_API_KEY}`
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur OpenAI texte: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ====================================================================
// ANTHROPIC
// ====================================================================
async function callAnthropicVision(imageDataUrl) {
  const baseUrl = VISION_API_BASE || 'https://api.anthropic.com/v1';
  const base64Data = imageDataUrl.split(',')[1];
  const mediaType = imageDataUrl.split(';')[0].split(':')[1];

  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': VISION_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyse ce plan électrique et retourne les dispositifs détectés au format JSON demandé.' },
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur Anthropic vision: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callAnthropicText(prompt) {
  const baseUrl = VISION_API_BASE || 'https://api.anthropic.com/v1';
  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': VISION_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur Anthropic texte: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// ====================================================================
// GOOGLE GEMINI
// ====================================================================
async function callGoogleVision(imageDataUrl) {
  const baseUrl = VISION_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
  const base64Data = imageDataUrl.split(',')[1];

  const response = await fetch(`${baseUrl}/models/${VISION_MODEL}:generateContent?key=${VISION_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: SYSTEM_PROMPT },
            { text: 'Analyse ce plan électrique et retourne les dispositifs détectés au format JSON demandé.' },
            { inline_data: { mime_type: getMimeTypeFromDataUrl(imageDataUrl), data: base64Data } }
          ]
        }
      ],
      generationConfig: { maxOutputTokens: 2000, temperature: 0.2 }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur Google vision: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function callGoogleText(prompt) {
  const baseUrl = VISION_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
  const response = await fetch(`${baseUrl}/models/${VISION_MODEL}:generateContent?key=${VISION_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: SYSTEM_PROMPT },
            { text: prompt }
          ]
        }
      ],
      generationConfig: { maxOutputTokens: 2000, temperature: 0.2 }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur Google texte: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// ====================================================================
// OPENROUTER (compatible OpenAI)
// ====================================================================
async function callOpenRouterVision(imageDataUrl) {
  const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': OPENROUTER_SITE_URL,
      'X-Title': OPENROUTER_APP_NAME
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyse ce plan électrique et retourne les dispositifs détectés au format JSON demandé.' },
            { type: 'image_url', image_url: { url: imageDataUrl } }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur OpenRouter vision: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callOpenRouterText(prompt) {
  const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': OPENROUTER_SITE_URL,
      'X-Title': OPENROUTER_APP_NAME
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur OpenRouter texte: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ====================================================================
// UTILITAIRES
// ====================================================================
function getMimeType(ext) {
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff'
  };
  return map[ext] || 'image/jpeg';
}

function getMimeTypeFromDataUrl(dataUrl) {
  return dataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
}

function parseVisionResponse(rawText) {
  // Nettoyer les balises markdown ```json ... ``` si présentes
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed.dispositifs)) {
      parsed.dispositifs = [];
    }
    return parsed;
  } catch (err) {
    console.warn('Réponse vision non parsable:', rawText);
    return { dispositifs: [], notes: 'Réponse non JSON', raw: rawText };
  }
}

function generateMockDetection(filePath, sourceType) {
  const fileName = path.basename(filePath);
  return {
    dispositifs: [
      { type_element: 'prise', code_symbol: 'P', position_x: 100, position_y: 100, label: `${fileName}-P1`, confiance: 0.85 },
      { type_element: 'prise', code_symbol: 'P', position_x: 200, position_y: 100, label: `${fileName}-P2`, confiance: 0.82 },
      { type_element: 'lumiere', code_symbol: 'L', position_x: 150, position_y: 200, label: `${fileName}-L1`, confiance: 0.88 },
      { type_element: 'interrupteur', code_symbol: 'VD', position_x: 250, position_y: 200, label: `${fileName}-VD1`, confiance: 0.80 }
    ],
    notes: `Mode mock - détection simulée depuis ${sourceType}`
  };
}

module.exports = {
  detectFromImage,
  detectFromPDF,
  detectFromCAD,
  parseVisionResponse
};
