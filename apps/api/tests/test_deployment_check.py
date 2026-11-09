"""A Pages release must wait for matching API content, without bypassing checks."""

import importlib.util
from unittest.mock import Mock
from urllib.error import HTTPError

import pytest

from app.config import ROOT

spec = importlib.util.spec_from_file_location(
    "deployment_check", ROOT / "scripts/check_deployment.py"
)
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


def test_waits_for_missing_publication_then_checks_again(monkeypatch):
    check = Mock(
        side_effect=[HTTPError("https://api.test/archive", 404, "Not Found", {}, None), None]
    )
    monkeypatch.setattr(checker, "check_api_once", check)
    monkeypatch.setattr(checker.time, "sleep", Mock())
    checker.check_api("https://api.test", "https://web.test", wait_seconds=60)
    assert check.call_count == 2


def test_fails_at_deadline_without_hiding_missing_content(monkeypatch):
    check = Mock(side_effect=HTTPError("https://api.test/archive", 404, "Not Found", {}, None))
    monkeypatch.setattr(checker, "check_api_once", check)
    monkeypatch.setattr(checker.time, "monotonic", Mock(side_effect=[0, 0, 61]))
    monkeypatch.setattr(checker.time, "sleep", Mock())
    with pytest.raises(RuntimeError, match="https://api.test/archive"):
        checker.check_api("https://api.test", "https://web.test", wait_seconds=60)
    assert check.call_count == 2


def test_does_not_retry_when_wait_is_disabled(monkeypatch):
    check = Mock(side_effect=AssertionError("Collections non synchronisées"))
    monkeypatch.setattr(checker, "check_api_once", check)
    with pytest.raises(RuntimeError, match="Collections non synchronisées"):
        checker.check_api("https://api.test", "https://web.test")
    assert check.call_count == 1
