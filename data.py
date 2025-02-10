import requests

# URL de ton API Render (remplace par la tienne)
API_URL = "https://gpt-mot-du-jour-app.onrender.com"

def get_word_of_the_day():
    """Récupère le mot du jour depuis l'API."""
    try:
        response = requests.get(f"{API_URL}/motdujour")
        if response.status_code == 200:
            return response.json()
        else:
            return {"error": "Impossible de récupérer le mot du jour"}
    except requests.exceptions.RequestException:
        return {"error": "L'API est inaccessible"}

def get_past_words():
    """Récupère l'historique des derniers mots depuis l'API."""
    try:
        response = requests.get(f"{API_URL}/historique")
        if response.status_code == 200:
            return response.json()
        else:
            return []
    except requests.exceptions.RequestException:
        return []