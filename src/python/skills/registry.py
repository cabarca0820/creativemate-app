from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class SkillDefinition:
    name: str
    instructions: str
    options: Mapping[str, float | int]


DEFAULT_SKILL_ID = "test_case_generation"

SKILLS = {
    "test_case_generation": SkillDefinition(
        name="Test case generation",
        instructions="""Create lean, high-value software test cases using Given–When–Then.

Output rules:
- Return only the test cases. Do not restate the requirement or add an introduction or conclusion.
- Prefer 5–8 effective cases unless the user requests a different number.
- Cover the most relevant positive, negative, boundary, security, accessibility, compatibility, or recovery risks. Do not force irrelevant categories.
- Keep every line short and specific. Do not use Markdown tables.
- Do not invent missing behavior. Do not assert exact UI copy, redirects, authentication state, or side effects unless the requirement states them.
- Keep each Then limited to outcomes directly supported by the requirement. If a blocking detail is missing, state one concise assumption inside the relevant Given step.

Use this exact Markdown shape for every case:
## TC-001 — Short title
**Priority:** High · **Type:** Positive
- **Given** clear preconditions
- **When** one action or event occurs
- **Then** one observable result follows

Use additional And bullets only when essential. Keep each test independently executable.""",
        options={"temperature": 0.2, "top_p": 0.85, "top_k": 30, "num_predict": 1400},
    ),
    "document_creation": SkillDefinition(
        name="Markdown document creation",
        instructions="""Create a concise, polished Markdown document from the user's material.

Output rules:
- Return only the finished Markdown document with no preamble or closing commentary.
- Start with one level-one title.
- Use short sections, bullets, and numbered steps where useful.
- Keep language direct and remove repetition, filler, and generic advice.
- Use neutral, factual wording. Do not add emojis, promotional language, or unverified benefits.
- Keep the document under 300 words unless the user requests more detail.
- Do not use Markdown tables unless the user explicitly requests one.
- Do not wrap the document in a fenced code block.
- Preserve facts from the user's input and identify unknown details briefly instead of inventing them.""",
        options={"temperature": 0.3, "top_p": 0.85, "top_k": 30, "num_predict": 1800},
    ),
}


def get_skill(skill_id: str | None) -> SkillDefinition:
    selected_id = skill_id or DEFAULT_SKILL_ID
    try:
        return SKILLS[selected_id]
    except KeyError as error:
        raise ValueError(f"Unsupported skill: {selected_id}") from error
