from pathlib import Path

from fastapi import FastAPI
import json
import datetime

app = FastAPI()

# Chemin vers words.json (relatif au fichier api.py, pas au CWD)
WORDS_PATH = Path(__file__).parent / "words.json"

_words_cache = None


def load_words():
    """Charge les mots depuis le JSON, avec cache en mémoire."""
    global _words_cache
    if _words_cache is None:
        with open(WORDS_PATH, "r", encoding="utf-8") as file:
            _words_cache = json.load(file)
    return _words_cache

# Endpoint pour récupérer le mot du jour
@app.get("/motdujour")
def get_word_of_the_day():
    words = load_words()
    today = datetime.date.today().strftime("%m-%d")  # Format MM-DD
    word_of_the_day = next((w for w in words if w["date"][-5:] == today), None)  # Compare MM-DD
    
    if word_of_the_day:
        return word_of_the_day
    return {"error": "Aucun mot disponible aujourd'hui"}

# Endpoint pour récupérer les derniers mots
@app.get("/historique")
def get_past_words():
    words = load_words()
    today = datetime.date.today().strftime("%m-%d")  # Format MM-DD
    past_words = [w for w in words if w["date"][-5:] < today][-5:]  # Compare uniquement MM-DD
    
    return past_words