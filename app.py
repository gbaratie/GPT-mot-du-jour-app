import streamlit as st
import json
import datetime

# Charger les mots
with open("words.json", "r", encoding="utf-8") as file:
    words = json.load(file)

# Trouver le mot du jour
today = datetime.date.today().strftime("%Y-%m-%d")
word_of_the_day = next((w for w in words if w["date"] == today), None)

# Interface Streamlit
st.title("📖 Mot du Jour")

if word_of_the_day:
    st.subheader(f"**{word_of_the_day['word']}**")
    st.write(f"📖 *{word_of_the_day['definition']}*")
    st.write(f"✍️ Exemple : _{word_of_the_day['example']}_")
else:
    st.write("Aucun mot disponible pour aujourd’hui.")

# Historique des derniers jours
st.subheader("🔙 Mots récents")
for word in words[:5]:
    st.write(f"**{word['word']}** - {word['definition']}")