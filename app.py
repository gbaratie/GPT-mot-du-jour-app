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
st.set_page_config(page_title="Mot du Jour", layout="centered")

# CSS pour un design plus moderne et épuré
st.markdown(
    """
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f9f9f9;
        }
        .container {
            max-width: 380px;
            margin: auto;
            padding: 20px;
        }
        .word-box {
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            margin-bottom: 20px;
        }
        .word-title {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 5px;
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
            background-color: #007ACC;
            color: white;
            box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.15);
        }
        .history-title {
            font-size: 18px;
            font-weight: 500;
            color: #222;
            margin-top: 30px;
            margin-bottom: 10px;
        }
        .history-box {
            background-color: #f3f3f3;
        }
    </style>
    """,
    unsafe_allow_html=True
)

# Conteneur principal
st.markdown("<div class='container'>", unsafe_allow_html=True)

# Affichage du mot du jour avec mise en valeur
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

# Historique des derniers mots (moins mis en avant)
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