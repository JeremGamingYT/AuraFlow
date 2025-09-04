# Configuration LM Studio pour AuraFlow

Ce guide vous explique comment configurer LM Studio pour fonctionner avec AuraFlow Web.

## 📋 Prérequis

1. **LM Studio** installé et configuré
2. Au moins un modèle chargé dans LM Studio
3. Le serveur local LM Studio démarré

## 🚀 Configuration rapide

### 1. Démarrer LM Studio

1. Lancez **LM Studio**
2. Allez dans l'onglet **"Models"** et chargez un modèle compatible avec le chat (ex: Llama, Mistral, etc.)
3. Une fois le modèle chargé, allez dans l'onglet **"Local Server"**
4. Cliquez sur **"Start Server"** (le bouton doit devenir vert)

### 2. Configuration de l'environnement

Créez un fichier `.env.local` dans votre projet ou modifiez le fichier `.env` existant :

```bash
# LM Studio Configuration
# Remplacez par l'IP de votre machine LM Studio
NEXT_PUBLIC_API_URL=http://192.165.2.65:1234

# Pour localhost (si LM Studio est sur la même machine)
# NEXT_PUBLIC_API_URL=http://localhost:1234
```

**Notes importantes :**
- Par défaut, LM Studio écoute sur le port `1234`
- Si LM Studio est sur une autre machine, utilisez son adresse IP locale
- Assurez-vous que le pare-feu autorise les connexions sur ce port

### 3. Vérifier la connexion

1. Démarrez votre application AuraFlow Web avec `pnpm dev`
2. Ouvrez la console de votre navigateur (F12)
3. Essayez d'envoyer un message
4. Vous devriez voir des messages de debug commençant par "🎯 Using LM Studio provider"

## 🔧 Configuration avancée

### Personnaliser les paramètres

Vous pouvez créer une instance personnalisée de LMStudioProvider :

```typescript
import { createLMStudioProvider } from '~/core/api/lm-studio';

const myLMStudio = createLMStudioProvider({
  baseURL: 'http://localhost:1234',
  model: 'llama-3.2-3b-instruct', // Utilisez le nom exact de votre modèle
  temperature: 0.8,
  maxTokens: 2048,
  stream: true
});
```

### Changer de modèle dynamiquement

```typescript
import { lmStudio } from '~/core/api/lm-studio';

// Obtenir la liste des modèles chargés
const models = await lmStudio.getLoadedModels();
console.log('Modèles disponibles:', models);

// Changer de modèle
await lmStudio.switchModel('nouveau-modele-id');
```

## 🔍 Résolution des problèmes

### Message "Unexpected endpoint or method. (OPTIONS...)"

**Problème :** LM Studio affiche des erreurs OPTIONS dans ses logs

**Explication :** C'est **NORMAL** ! Le navigateur envoie des requêtes CORS préalables (preflight) qui génèrent ces messages. LM Studio répond quand même correctement avec un code 200.

**Solutions :**
- ✅ **Ignorez ces messages**, ils n'empêchent pas le fonctionnement
- ✅ Le chat devrait fonctionner malgré ces logs
- ✅ C'est un comportement standard des navigateurs web

### Erreur de connexion (`ECONNREFUSED`)

**Problème :** Ne peut pas se connecter à LM Studio

**Solutions :**
1. ✅ Vérifiez que LM Studio est lancé
2. ✅ Vérifiez que le serveur local est démarré (bouton vert "Start Server")
3. ✅ Vérifiez l'URL dans `NEXT_PUBLIC_API_URL` (incluant l'IP correcte)
4. ✅ Vérifiez que le port n'est pas bloqué par un firewall
5. ✅ Si LM Studio est sur une autre machine, vérifiez la connectivité réseau

### Erreur "No models loaded"

**Problème :** Aucun modèle n'est chargé dans LM Studio

**Solutions :**
1. ✅ Allez dans l'onglet "Models" de LM Studio
2. ✅ Chargez un modèle compatible avec le chat
3. ✅ Attendez que le chargement soit terminé (100%)
4. ✅ Vérifiez que vous avez suffisamment de RAM libre

### Erreur 500 (Server Error)

**Problème :** Erreur interne du serveur LM Studio

**Solutions :**
1. ✅ Redémarrez le serveur LM Studio
2. ✅ Rechargez le modèle
3. ✅ Vérifiez les logs de LM Studio pour des erreurs
4. ✅ Vérifiez les ressources système (RAM, CPU)

### Réponse lente ou timeout

**Problème :** Les réponses sont très lentes

**Solutions :**
1. ✅ Utilisez un modèle plus petit (ex: 7B au lieu de 70B)
2. ✅ Réduisez `maxTokens` dans la configuration
3. ✅ Fermez d'autres applications consommatrices de RAM
4. ✅ Utilisez le mode non-streaming si nécessaire : `stream: false`

## 🎯 Modèles recommandés

### Pour un usage rapide (< 8GB RAM)
- **Llama 3.2 3B Instruct** - Équilibré
- **Phi-3 Mini** - Très rapide
- **Qwen2.5 7B Instruct** - Bonne qualité

### Pour une meilleure qualité (8-16GB RAM)
- **Llama 3.1 8B Instruct** - Excellent équilibre
- **Mistral 7B Instruct** - Très polyvalent
- **CodeLlama 7B** - Optimisé pour le code

### Pour la meilleure qualité (16GB+ RAM)
- **Llama 3.1 70B Instruct** (quantisé)
- **Mixtral 8x7B** - Très performant
- **CodeLlama 34B** - Excellent pour le code

## 🚨 Notes importantes

1. **Mémoire :** Assurez-vous d'avoir suffisamment de RAM libre pour le modèle choisi
2. **Modèles :** Seuls les modèles de type "Instruct" ou "Chat" fonctionnent bien pour la conversation
3. **Quantification :** Les modèles quantifiés (Q4, Q8) utilisent moins de RAM mais peuvent être légèrement moins précis
4. **Streaming :** Le streaming permet une réponse progressive, mais peut être désactivé si problématique

## 📞 Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs dans la console du navigateur
2. Vérifiez les logs de LM Studio
3. Testez avec l'interface web de LM Studio (http://localhost:1234)
4. Essayez avec un modèle différent
