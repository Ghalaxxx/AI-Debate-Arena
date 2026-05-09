"""PRO and CON debate agent logic."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from config import SETTINGS
from scoring.models import Argument, DebaterSide

PRO_SYSTEM_PROMPT = """You are a skilled debate champion arguing IN FAVOR of the following topic.

TOPIC: {topic}

RULES:
1. You are PRO - you MUST defend and support this topic with conviction
2. Keep your argument to 100-150 words maximum
3. Every argument must: make a clear claim, provide reasoning, and connect to evidence
4. If a CON argument exists, you MUST directly address and counter it
5. Never repeat an argument you have already made
6. Use rhetorical devices: analogies, statistics references, rhetorical questions
7. Be passionate but logical - no logical fallacies
8. End with a strong concluding sentence

PREVIOUS ARGUMENTS YOU MADE:
{pro_history}

LATEST CON ARGUMENT TO COUNTER:
{latest_con_argument}

Respond with ONLY your argument text. No preamble, no "As a debater...", just the argument."""

CON_SYSTEM_PROMPT = """You are a skilled debate champion arguing AGAINST the following topic.

TOPIC: {topic}

RULES:
1. You are CON - you MUST oppose and challenge this topic with conviction
2. Keep your argument to 100-150 words maximum
3. Every argument must: make a clear counterclaim, provide evidence, expose weaknesses
4. You MUST directly refute the latest PRO argument
5. Never repeat an argument you have already made
6. Use rhetorical devices: deconstruction, counterexamples, revealing assumptions
7. Be incisive and sharp - find the weakest point in the PRO argument and attack it
8. End with a strong opposing statement

PREVIOUS ARGUMENTS YOU MADE:
{con_history}

LATEST PRO ARGUMENT TO COUNTER:
{latest_pro_argument}

Respond with ONLY your argument text. No preamble, just the argument."""


def _format_history(arguments: list[Argument]) -> str:
    if not arguments:
        return "None yet."
    return "\n".join(f"Round {argument.round_number}: {argument.text}" for argument in arguments)


def _truncate_words(text: str, max_words: int) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text.strip()
    return " ".join(words[:max_words]).rstrip(".,;:") + "."


@dataclass(slots=True)
class DebaterAgent:
    """LLM-backed debate agent with a deterministic local fallback."""

    side: DebaterSide
    model: str

    async def generate_argument(
        self,
        topic: str,
        pro_history: list[Argument],
        con_history: list[Argument],
        latest_opponent_argument: Argument | None,
        round_number: int,
        language: str = "en",
    ) -> str:
        """Generate one debate turn for the configured side."""

        prompt = self._build_prompt(topic, pro_history, con_history, latest_opponent_argument, language)
        if self.model == "local-fallback":
            return self._fallback_argument(topic, latest_opponent_argument, round_number, language)
        if self.model.lower().startswith("gpt") and SETTINGS.openai_api_key:
            try:
                generated = await self._call_openai(prompt)
                return _truncate_words(generated, SETTINGS.argument_max_words)
            except Exception:
                pass
        if SETTINGS.anthropic_api_key:
            try:
                generated = await self._call_anthropic(prompt)
                return _truncate_words(generated, SETTINGS.argument_max_words)
            except Exception:
                pass
        return self._fallback_argument(topic, latest_opponent_argument, round_number, language)

    def _build_prompt(
        self,
        topic: str,
        pro_history: list[Argument],
        con_history: list[Argument],
        latest_opponent_argument: Argument | None,
        language: str,
    ) -> str:
        latest_text = latest_opponent_argument.text if latest_opponent_argument else "None yet."
        language_instruction = (
            "\nLANGUAGE REQUIREMENT: Respond fully in Arabic with clear, formal debate Arabic."
            if language == "ar"
            else "\nLANGUAGE REQUIREMENT: Respond in English."
        )
        if self.side == "PRO":
            return PRO_SYSTEM_PROMPT.format(
                topic=topic,
                pro_history=_format_history(pro_history),
                latest_con_argument=latest_text,
            ) + language_instruction
        return CON_SYSTEM_PROMPT.format(
            topic=topic,
            con_history=_format_history(con_history),
            latest_pro_argument=latest_text,
        ) + language_instruction

    async def _call_anthropic(self, system_prompt: str) -> str:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=SETTINGS.anthropic_api_key)
        response: Any = await client.messages.create(
            model=self.model,
            max_tokens=500,
            temperature=0.75,
            system=system_prompt,
            messages=[{"role": "user", "content": "Generate the next debate argument now."}],
        )
        text_parts = [
            block.text for block in response.content if getattr(block, "type", "") == "text" and block.text
        ]
        return " ".join(text_parts).strip()

    async def _call_openai(self, system_prompt: str) -> str:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=SETTINGS.openai_api_key)
        response = await client.chat.completions.create(
            model=self.model,
            max_tokens=500,
            temperature=0.75,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Generate the next debate argument now."},
            ],
        )
        return (response.choices[0].message.content or "").strip()

    def _fallback_argument(
        self,
        topic: str,
        latest_opponent_argument: Argument | None,
        round_number: int,
        language: str = "en",
    ) -> str:
        if language == "ar":
            return self._fallback_arabic_argument(topic, latest_opponent_argument, round_number)
        pro_angles = (
            "public benefit",
            "long-term incentives",
            "risk reduction",
            "fair access",
            "institutional accountability",
        )
        con_angles = (
            "unintended consequences",
            "individual liberty",
            "implementation cost",
            "weak evidence",
            "centralized overreach",
        )
        if self.side == "PRO":
            angle = pro_angles[(round_number - 1) % len(pro_angles)]
            counter = (
                f"The CON side says '{latest_opponent_argument.text[:120]}...', but that objection treats tradeoffs as defeat."
                if latest_opponent_argument
                else "The strongest starting premise is that policy should solve real harms before they compound."
            )
            text = (
                f"{counter} The case for {topic} rests on a clear premise: when a choice produces broad {angle}, "
                f"society should build rules that make the better outcome easier to reach. Research and historical "
                f"experience repeatedly show that early, coordinated action can lower cost, improve trust, and protect "
                f"people who cannot solve system-level problems alone. Why accept preventable damage when structured "
                f"support can turn private effort into public progress? {topic} is not idealism; it is practical governance."
            )
        else:
            angle = con_angles[(round_number - 1) % len(con_angles)]
            counter = (
                f"The PRO argument claims '{latest_opponent_argument.text[:120]}...', but it skips the hardest question."
                if latest_opponent_argument
                else "The burden is on supporters to prove that this proposal works beyond slogans."
            )
            text = (
                f"{counter} Opposing {topic} follows a simple premise: good intentions do not guarantee good systems. "
                f"Policies built around {angle} often create incentives that are costly, unfair, or impossible to audit. "
                f"According to common policy analysis, the decisive issue is not whether the goal sounds noble, but "
                f"whether the mechanism survives real-world pressure. If the plan cannot control side effects, it should "
                f"not be treated as progress. {topic} is a risky answer to a problem that needs sharper tools."
            )
        return _truncate_words(text, SETTINGS.argument_max_words)

    def _fallback_arabic_argument(
        self,
        topic: str,
        latest_opponent_argument: Argument | None,
        round_number: int,
    ) -> str:
        pro_angles = ("المصلحة العامة", "تقليل المخاطر", "الثقة المؤسسية", "العدالة", "الكلفة بعيدة المدى")
        con_angles = ("الآثار الجانبية", "الحرية الفردية", "صعوبة التنفيذ", "ضعف الأدلة", "المبالغة التنظيمية")
        if self.side == "PRO":
            angle = pro_angles[(round_number - 1) % len(pro_angles)]
            counter = (
                f"يعترض الطرف المعارض بأن '{latest_opponent_argument.text[:100]}...'، لكن هذا الاعتراض يضخم المخاطر ويتجاهل المكاسب العملية."
                if latest_opponent_argument
                else "تنطلق حجتي من مقدمة واضحة: السياسات الجيدة يجب أن تمنع الضرر قبل أن يصبح واسع النطاق."
            )
            text = (
                f"{counter} إن تأييد موضوع {topic} يستند إلى {angle}، لأن القرار العام لا يقاس بالشعار بل بقدرته على حماية الناس وبناء الثقة. "
                "تشير الخبرة التاريخية وتحليل السياسات إلى أن التدخل المبكر عندما يكون منضبطا يقلل الكلفة ويجعل الابتكار أكثر أمانا وعدلا. "
                "فلماذا ننتظر وقوع الضرر إذا كان التنظيم الذكي قادرا على تحويل التقدم إلى منفعة عامة؟ هذا الموقف ليس حماسا مجردا، بل حكم عملي مسؤول."
            )
        else:
            angle = con_angles[(round_number - 1) % len(con_angles)]
            counter = (
                f"يدعي الطرف المؤيد أن '{latest_opponent_argument.text[:100]}...'، لكنه يتجاوز السؤال الأهم: كيف نمنع فشل الآلية نفسها؟"
                if latest_opponent_argument
                else "يقع عبء الإثبات على المؤيدين؛ فحسن النية لا يكفي لصنع سياسة ناجحة."
            )
            text = (
                f"{counter} إن رفض موضوع {topic} يقوم على مقدمة بسيطة: كل تدخل واسع قد ينتج {angle} إذا لم يكن قابلا للمراجعة والمساءلة. "
                "المشكلة ليست في جمال الهدف، بل في قدرة النظام على الصمود أمام الواقع والكلفة والحوافز الخاطئة. "
                "إذا كانت الخطة لا تضبط آثارها الجانبية، فلا يجوز تقديمها كحل نهائي. المعارضة هنا دفاع عن سياسة أدق وأكثر مسؤولية."
            )
        return _truncate_words(text, SETTINGS.argument_max_words)


class ProDebater(DebaterAgent):
    """Debater constrained to argue in favor of the topic."""

    def __init__(self, model: str | None = None) -> None:
        super().__init__(side="PRO", model=model or SETTINGS.pro_model)


class ConDebater(DebaterAgent):
    """Debater constrained to argue against the topic."""

    def __init__(self, model: str | None = None) -> None:
        super().__init__(side="CON", model=model or SETTINGS.con_model)
