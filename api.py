from fastapi import FastAPI
import json
import datetime

app = FastAPI()

# Charger les mots depuis le fichier JSON
def load_words():
    with open("words.json", "r", encoding="utf-8") as file:
        return json.load(file)

# Endpoint pour récupérer le mot du jour
@app.get("/motdujour")
def get_word_of_the_day():
    words = load_words()
    today = datetime.date.today().strftime("%m-%d")  # Format MM-DD
    word_of_the_day = next((w for w in words if w["date"].endswith(today)), None)  # Ignore l'année
    
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