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

# Interface Streamlit - Amélioration du design
st.set_page_config(page_title="Mot du Jour", page_icon="📖", layout="centered")

# CSS pour améliorer l’apparence
st.markdown(
    """
    <style>
        body {
            font-family: 'Arial', sans-serif;
            background-color: #f7f7f7;
        }
        .word-box {
            background-color: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
            text-align: center;
            margin: 20px auto;
            max-width: 600px;
        }
        .word-title {
            font-size: 24px;
            font-weight: bold;
            color: #007ACC;
        }
        .word-definition {
            font-size: 18px;
            font-style: italic;
            color: #444;
        }
        .word-example {
            font-size: 16px;
            margin-top: 10px;
            color: #666;
        }
    </style>
    """,
    unsafe_allow_html=True
)

st.title("📖 Mot du Jour")

if word_of_the_day:
    st.markdown(
        f"""
        <div class='word-box'>
            <div class='word-title'>{word_of_the_day['word']}</div>
            <div class='word-definition'>📖 {word_of_the_day['definition']}</div>
            <div class='word-example'>✍️ Exemple : <i>{word_of_the_day['example']}</i></div>
        </div>
        """,
        unsafe_allow_html=True
    )
else:
    st.warning("Aucun mot disponible pour aujourd’hui.")

# Historique des derniers jours
if past_words:
    st.subheader("🔙 Mots récents")
    for word in reversed(past_words):  # Afficher du plus récent au plus ancien
        st.markdown(
            f"""
            <div class='word-box' style='background-color: #e8f4fc;'>
                <div class='word-title'>{word['word']}</div>
                <div class='word-definition'>📖 {word['definition']}</div>
                <div class='word-example'>✍️ Exemple : <i>{word['example']}</i></div>
            </div>
            """,
            unsafe_allow_html=True
        )