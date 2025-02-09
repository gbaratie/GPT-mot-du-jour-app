import streamlit as st
from data import load_words, get_word_of_the_day, get_past_words
from styles import get_css

# Configuration de la page Streamlit
st.set_page_config(page_title="Mot du Jour", layout="wide")

# Appliquer le CSS en premier
st.markdown(get_css(), unsafe_allow_html=True)

# Charger les mots depuis le JSON
words = load_words()
word_of_the_day = get_word_of_the_day(words)
past_words = get_past_words(words)

# Conteneur principal
st.markdown("<div class='container'>", unsafe_allow_html=True)

# Affichage du mot du jour
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

# Historique des derniers mots
if past_words:
    st.markdown("<div class='history-title'>Historique</div>", unsafe_allow_html=True)
    for word in reversed(past_words):
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