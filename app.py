import streamlit as st
import json
import datetime

# Charger les mots
with open("words.json", "r", encoding="utf-8") as file:
    words = json.load(file)

# Trouver le mot du jour
today = datetime.date.today().strftime("%Y-%m-%d")
word_of_the_day = next((w for w in words if w["date"] == today), None)

# Récupérer les mots des 5 derniers jours (sans le jour J)
past_words = [w for w in words if w["date"] < today][-5:]

# Configuration de la page Streamlit
st.set_page_config(page_title="Mot du Jour", layout="wide")

# CSS pour un design épuré et une mise en page fluide
st.markdown(
    """
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f9f9f9;
        }
        .container {
            max-width: 100%;
            margin: auto;
            padding: 0;
        }
        .word-box {
            width: 100%;
            padding: 40px;
            border-radius: 0;
            text-align: center;
            margin-bottom: 10px;
        }
        .word-title {
            font-size: 26px;
            font-weight: 700;
            margin-bottom: 10px;
        }
        .word-definition {
            font-size: 18px;
            line-height: 1.5;
            font-weight: 400;
        }
        .word-example {
            font-size: 16px;
            font-style: italic;
            margin-top: 10px;
            color: #555;
        }
        .highlight {
            background-color: white;
            border-bottom: 3px solid #ddd;
            padding-top: 60px;
            padding-bottom: 60px;
        }
        .history-title {
            font-size: 20px;
            font-weight: 500;
            color: #222;
            margin: 30px 0 15px;
            text-align: center;
        }
        .history-box {
            background-color: #f7f7f7;
            padding: 30px;
        }
    </style>
    """,
    unsafe_allow_html=True
)

# Conteneur principal
st.markdown("<div class='container'>", unsafe_allow_html=True)

# Affichage du mot du jour (grande largeur)
if word_of_the_day:
    st.markdown(
        f"""
        <div class='word-box highlight'>
            <div class='word-title'>{word_of_the_day['word']}</div>
            <div class='word-definition'>{word_of_the_day['definition']}</div>
            <div class='word-example'>{word_of_the_day['example']}</div>
        </div>
        """,
        unsafe_allow_html=True
    )
else:
    st.warning("Aucun mot disponible aujourd’hui.")

# Historique des derniers mots (sans trop d’espace inutile)
if past_words:
    st.markdown("<div class='history-title'>Historique</div>", unsafe_allow_html=True)
    for word in reversed(past_words):  # Afficher du plus récent au plus ancien
        st.markdown(
            f"""
            <div class='word-box history-box'>
                <div class='word-title'>{word['word']}</div>
                <div class='word-definition'>{word['definition']}</div>
                <div class='word-example'>{word['example']}</div>
            </div>
            """,
            unsafe_allow_html=True
        )

st.markdown("</div>", unsafe_allow_html=True)