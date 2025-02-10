import streamlit as st
from data import get_word_of_the_day, get_past_words

# Configuration de la page
st.set_page_config(page_title="Mot du Jour", layout="wide")

# Appliquer le CSS
st.markdown(
    """
    <style>
        /* Conteneur principal */
        .container {
            max-width: 100%;
            margin: auto;
            padding: 0;
        }

        /* Bloc du mot du jour */
        .word-box {
            width: 100%;
            height: 80vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            background-color: var(--background-color);
            border-bottom: 3px solid var(--secondary-background-color);
            color: var(--text-color);
            padding: 20px;
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
            color: var(--text-color);
            opacity: 0.8;
            padding: 0 20px;
        }

        /* Titre de l'historique */
        .history-title {
            font-size: 18px;
            font-weight: 500;
            margin-top: 10px;
            margin-bottom: 10px;
            text-align: center;
            color: var(--text-color);
        }

        /* Bloc de l'historique */
        .history-box {
            background-color: var(--secondary-background-color);
            color: var(--text-color);
            padding: 15px;
            margin-bottom: 5px;
            border-radius: 8px;
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
            color: var(--text-color);
            opacity: 0.8;
        }
    </style>
    """,
    unsafe_allow_html=True
)

# Récupérer les données depuis l'API
word_of_the_day = get_word_of_the_day()
past_words = get_past_words()

# Conteneur principal
st.markdown("<div class='container'>", unsafe_allow_html=True)

# Affichage du mot du jour
if "error" in word_of_the_day:
    st.warning(word_of_the_day["error"])
else:
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

# Historique des derniers mots
if past_words:
    st.markdown("<div class='history-title'>Historique</div>", unsafe_allow_html=True)
    for word in past_words:
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