from datetime import date

from app.content import CollectionDefinition
from app.duplicates import find_duplicates


def collection(kind, slug="test", locale="fr-FR"):
    return CollectionDefinition(
        slug=slug,
        name="Test",
        description="Test",
        kind=kind,
        locale=locale,
        coverage=[{"start": "2025-01-01", "end": "2025-01-01"}],
    )


def entry(day, **payload):
    return {"publication_date": date.fromisoformat(day), "payload": payload}


def test_word_identity_ignores_accents_case_punctuation_and_new_definition():
    c = collection("word")
    existing = entry("2025-01-01", term="Sérendipité", definition="Ancien sens")
    candidate = entry("2027-01-01", term=" SÉRENDIPITÉ ! ", definition="Autre sens")
    assert find_duplicates(c, [candidate], [(c, [existing])])[0]["match"] == "exact"


def test_quote_identity_ignores_changed_attribution_and_source():
    c = collection("quote")
    original = entry("2025-01-01", text="La vie est belle.", author="A")
    changed = entry("2027-01-01", text="La vie est belle !", author="B")
    assert find_duplicates(c, [changed], [(c, [original])])[0]["match"] == "exact"


def test_riddle_number_variations_and_paraphrases_are_flagged():
    c = collection("riddle")
    original = entry(
        "2025-01-01",
        question="Dans une salle, 33 personnes se serrent la main. Combien de poignées ?",
    )
    variation = entry(
        "2027-01-01",
        question="Dans une salle, 45 personnes se serrent la main. Combien de poignées ?",
    )
    close = entry(
        "2027-01-02",
        question="Dans une salle, 33 personnes se serrent la main. Combien de poignées de main ?",
    )
    findings = find_duplicates(c, [variation, close], [(c, [original])])
    assert {f["match"] for f in findings} >= {"template", "near"}


def test_checks_whole_batch_and_other_collections_but_respects_kind_and_language():
    c = collection("word")
    candidates = [entry("2027-01-01", term="Nouveau"), entry("2027-01-02", term="nouveau")]
    assert find_duplicates(c, candidates, [])[0]["existing_date"] == "2027-01-01"
    other = collection("word", "autre")
    assert find_duplicates(c, candidates[:1], [(other, candidates[1:])])
    assert not find_duplicates(
        c, candidates[:1], [(collection("word", locale="en-GB"), candidates[1:])]
    )
    assert not find_duplicates(
        c, candidates[:1], [(collection("quote"), [entry("2025-01-01", text="Nouveau")])]
    )
