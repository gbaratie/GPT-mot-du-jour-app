import json
import datetime

def load_words(filename="words.json"):
    """Charge les mots depuis un fichier JSON."""
    with open(filename, "r", encoding="utf-8") as file:
        return json.load(file)

def get_word_of_the_day(words):
    """Retourne le mot du jour basé sur la date actuelle."""
    today = datetime.date.today().strftime("%Y-%m-%d")
    return next((w for w in words if w["date"] == today), None)

def get_past_words(words, days=5):
    """Retourne les mots des X derniers jours, sans inclure le jour actuel."""
    today = datetime.date.today().strftime("%Y-%m-%d")
    return [w for w in words if w["date"] < today][-days:]