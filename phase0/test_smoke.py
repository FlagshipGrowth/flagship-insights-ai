"""Smoke test for the subagent + synthesis plumbing, using a stubbed client so it runs
without ANTHROPIC_API_KEY. Run with: python test_smoke.py
"""

import json
from types import SimpleNamespace

from subagents import run_channel_subagent
from synthesis import synthesize

STUB_FINDING = {
    "summary": "Sales dipped 12% week over week while ad spend held flat.",
    "notable_changes": ["ASIN B0STUB01 conversion rate fell from 14% to 9%"],
    "risks": ["TACoS rising faster than sales"],
    "opportunities": ["Restock B0STUB01 before the weekend spike"],
}


class StubMessages:
    def __init__(self, response_text):
        self._response_text = response_text

    def create(self, **kwargs):
        return SimpleNamespace(content=[SimpleNamespace(text=self._response_text)])


class StubClient:
    def __init__(self, response_text):
        self.messages = StubMessages(response_text)


def test_run_channel_subagent_parses_json():
    client = StubClient(json.dumps(STUB_FINDING))
    finding = run_channel_subagent(client, "amazon", "BB-Bands", {"placeholder": True}, "stub-model")
    assert finding["channel"] == "amazon"
    assert finding["summary"] == STUB_FINDING["summary"]
    assert finding["notable_changes"] == STUB_FINDING["notable_changes"]


def test_run_channel_subagent_falls_back_on_non_json():
    client = StubClient("not json")
    finding = run_channel_subagent(client, "amazon", "BB-Bands", {"placeholder": True}, "stub-model")
    assert finding["summary"] == "not json"
    assert finding["channel"] == "amazon"


def test_synthesize_returns_text():
    client = StubClient("Restock B0STUB01 before the weekend and hold spend flat.")
    recommendation = synthesize(client, "BB-Bands", [STUB_FINDING], "stub-model")
    assert "Restock" in recommendation


if __name__ == "__main__":
    test_run_channel_subagent_parses_json()
    test_run_channel_subagent_falls_back_on_non_json()
    test_synthesize_returns_text()
    print("All smoke tests passed.")
