def get_css():
    """Retourne le CSS pour le design de l'application."""
    return """
    <style>
        .container {
            max-width: 100%;
            margin: auto;
            padding: 0;
        }
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
        }
        .history-title {
            font-size: 18px;
            font-weight: 500;
            margin-top: 10px;
            margin-bottom: 10px;
            text-align: center;
        }
        .history-box {
            background-color: var(--secondary-background-color);
            color: var(--text-color);
            padding: 15px;
            margin-bottom: 5px;
        }
    </style>
    """