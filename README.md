# 📖 Mot du Jour

Une application web qui affiche un **mot du jour** avec sa définition et un exemple d'utilisation.

🚀 **Démo en ligne** : [mot-du-jour.streamlit.app](https://mot-du-jour.streamlit.app)

---

## 🏗️ Architecture

Le projet est conçu pour tourner avec **Streamlit** (interface) et **Render** (API) :

| Composant | Rôle | Hébergement |
|------------|------|-------------|
| **API** (`api.py`) | Sert le mot du jour et l'historique depuis `words.json` | Render |
| **App** (`app.py` + `data.py`) | Interface utilisateur qui appelle l'API | Streamlit Community Cloud |

L'app Streamlit appelle l'URL de l'API Render pour afficher les données. Les deux services peuvent être déployés séparément.

---

## 🚀 Déploiement

### 1. Déployer l'API sur Render

1. Crée un compte sur [render.com](https://render.com) et connecte ton dépôt GitHub.
2. **New** → **Web Service**.
3. Choisis ce dépôt et configure :
   - **Name** : `gpt-mot-du-jour-app` (ou autre).
   - **Runtime** : **Python 3**.
   - **Build command** : `pip install -r requirements.txt`
   - **Start command** : `uvicorn api:app --host 0.0.0.0 --port $PORT`
4. Render utilise le **répertoire racine** du repo : le fichier `words.json` doit être à la racine (il est bien versionné dans le dépôt).
5. Déploie. Render te donne une URL du type `https://ton-app.onrender.com`.

> **Note** : Sur le plan gratuit, le service peut s’endormir après inactivité ; le premier appel après une pause peut être lent.

### 2. Déployer l'app sur Streamlit Community Cloud

1. Crée un compte sur [share.streamlit.io](https://share.streamlit.io) (connexion GitHub).
2. **New app** → choisis ce dépôt, branche `main`, fichier **`app.py`**.
3. Dans **Advanced settings**, ajoute la variable d'environnement :
   - **Key** : `MOT_DU_JOUR_API_URL`
   - **Value** : l’URL de ton API Render (ex. `https://gpt-mot-du-jour-app.onrender.com`)
4. Déploie. L’app sera accessible à une adresse du type `https://ton-app.streamlit.app`.

### 3. Ordre conseillé

Déploie d’abord l’**API sur Render** pour obtenir l’URL, puis l’**app sur Streamlit** en renseignant `MOT_DU_JOUR_API_URL`. Sans cette variable, l’app utilise par défaut l’URL d’exemple (celle de la démo).

---

## ⚙️ Configuration

| Variable | Où | Description |
|----------|-----|-------------|
| `MOT_DU_JOUR_API_URL` | Streamlit (Cloud ou local) | URL de l’API (ex. Render). Par défaut : API de la démo. |

En local, tu peux lancer l’API avec `uvicorn api:app --reload` puis l’app avec `streamlit run app.py` après avoir défini `MOT_DU_JOUR_API_URL=http://localhost:8000`.

---

## 🌟 Fonctionnalités

- Un nouveau mot chaque jour 📆
- Définition et exemple d'utilisation 📖
- Accès aux derniers mots récents 🔙
- Interface simple et épurée 🎨
