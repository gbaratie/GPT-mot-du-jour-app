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

# CSS amélioré pour un design optimisé
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
        /* Mot du jour : prend presque tout l'écran */
        .word-box {
            width: 100%;
            height: 80vh; /* Prend 80% de la hauteur de l'écran */
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            background-color: white;
            border-bottom: 3px solid #ddd;
        }
        .word-title {
            font-size: 30px;
            font-weight: 700;
            margin-bottom: 10px;
        }
        .word-definition {
            font-size: 20px;
            line-height: 1.6;
            font-weight: 400;
            padding: 0 20px;
        }
        .word-example {
            font-size: 18px;
            font-style: italic;
            margin-top: 15px;
            color: #555;
            padding: 0 20px;
        }
        /* Historique : police plus petite et espacements réduits */
        .history-title {
            font-size: 18px;
            font-weight: 500;
            color: #222;
            margin-top: 10px;
            margin-bottom: 10px;
            text-align: center;
        }
        .history-box {
            background-color: #f7f7f7;
            padding: 15px;
            margin-bottom: 5px;
        }
        .history-title-word {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 5px;
        }
        .history-definition {
            font-size: 14px;
            line-height: 1.4;
            font-weight: 400;
        }
        .history-example {
            font-size: 13px;
            font-style: italic;
            margin-top: 5px;
            color: #555;
        }
    </style>
    """,
    unsafe_allow_html=True
)

# Conteneur principal
st.markdown("<div class='container'>", unsafe_allow_html=True)

# Affichage du mot du jour (occupe presque tout l'écran)
if word_of_the_day:
    st.markdown(
        f"""
        <div class='word-box'>
            <div class='word-title'>{word_of_the_day['word']}</div>
            <div class='word-definition'>{word_of_the_day['definition']}</div>
            <div class='word-example'>{word_of_the_day['example']}</div>
        </div>
        """,
        unsafe_allow_html=True
    )
else:
    st.warning("Aucun mot disponible aujourd’hui.")

# Historique des derniers mots (plus compact)
if past_words:
    st.markdown("<div class='history-title'>Historique</div>", unsafe_allow_html=True)
    for word in reversed(past_words):  # Afficher du plus récent au plus ancien
        st.markdown(
            f"""
            <div class='history-box'>
                <div class='history-title-word'>{word['word']}</div>
                <div class='history-definition'>{word['definition']}</div>
                <div class='history-example'>{word['example']}</div>
            </div>
            """,
            unsafe_allow_html=True
        )

st.markdown("</div>", unsafe_allow_html=True)