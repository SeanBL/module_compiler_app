from __future__ import annotations

from typing import List

from .models.raw_models import RawSlide
from .models.schema import (
    Module,
    PanelSlide,
    Engage1Slide,
    Engage1Item,
    Engage2Slide,
    QuizSlide,
    QuizQuestion,
    QuizOption,
    Engage2Layer,
    DecisionSlide,
)


# --------------------------------------------------
# Block Conversion
# --------------------------------------------------

def blocks_to_strings(blocks):
    print("🚨 USING UPDATED blocks_to_strings")
    output = []

    for block in blocks:
        if block.type == "paragraph":
            output.append({
                "type": "paragraph",
                "text": block.text,
                "image": block.image,
                "modifiers": block.modifiers
            })
        elif block.type == "bullets":
            output.append({
                "type": "bullets",
                "items": block.items
            })

    return output

# --------------------------------------------------
# Slide Conversion
# --------------------------------------------------

def convert_slide(raw: RawSlide):
    if raw.slide_type == "panel":
        return PanelSlide(
            type="panel",
            header=raw.header,
            body=blocks_to_strings(raw.body or []),
            optional=raw.optional,
            image=raw.image,
            panel_pdf=raw.panel_pdf,
        )

    if raw.slide_type == "engage1":
        items = []

        for item in raw.engage1_items or []:
            combined_text = blocks_to_strings(item.body)

            items.append(
                Engage1Item(
                    label=item.label,
                    text=combined_text,
                    image=item.image,
                )
            )

        intro_text = ""
        if raw.engage1_intro:
            intro_text = blocks_to_strings(raw.engage1_intro)

        return Engage1Slide(
            type="engage_1",
            optional=raw.optional,
            header=raw.header,
            intro=intro_text,
            intro_image=raw.engage1_intro_image,
            items=items,
        )

    if raw.slide_type == "engage2":

        intro_text = ""
        intro_image = raw.engage2_intro_image

        if raw.engage2_intro:
            intro_blocks = blocks_to_strings(raw.engage2_intro)
            intro_text = "\n".join(intro_blocks)

        layers = []

        for block in raw.engage2_layers or []:
            layers.append(
                Engage2Layer(
                    text=block.text,
                    image=block.image,
                )
            )

        return Engage2Slide(
            type="engage_2",
            optional=raw.optional,
            header=raw.header,
            intro=intro_text,
            intro_image=intro_image,
            layers=layers,
            button_label=raw.engage2_button_label or "Continue",
        )
    
    if raw.slide_type == "decision":

        return DecisionSlide(
            type="decision",
            optional=raw.optional,
            header=raw.header,
            body=blocks_to_strings(raw.body or []),
            buttons=raw.decision_buttons or [],
        )

    if raw.slide_type == "quiz":
        slides = []

        for q in raw.quiz_questions or []:
            options = [
                QuizOption(id=o.id, text=o.text)
                for o in (q.options or [])
            ]

            question = QuizQuestion(
                prompt=q.prompt,
                options=options,
                correct_option_id=q.correct_option_id,
                explanation=q.explanation,
            )

            slides.append(
                QuizSlide(
                    type="quiz",
                    quiz_scope=raw.quiz_scope or "inline",
                    quiz_type=raw.quiz_type or "mcq",
                    questions=[question],   # ← ONE QUESTION ONLY
                )
            )

        return slides

    raise ValueError(f"Unknown slide type: {raw.slide_type}")


# --------------------------------------------------
# Module Conversion
# --------------------------------------------------

def build_module(module_id: str, raw_slides: List[RawSlide]) -> Module:
    slides = []

    for s in raw_slides:
        converted = convert_slide(s)

        if isinstance(converted, list):
            slides.extend(converted)
        else:
            slides.append(converted)

    return Module(
        module_id=module_id,
        slides=slides,
    )

def build_disclaimer_slide():
    return PanelSlide(
        type="panel",
        header="WiRED International Disclaimer",
        body=[
            {
                "type": "paragraph",
                "text": "Some WiRED Community Health Information modules may provide links to material prepared by other institutions. These are offered as a convenience. WiRED is not responsible for the content of this material, nor does WiRED endorse, warrant or guarantee the products, services or information described or offered."
            },
            {
                "type": "paragraph",
                "text": "It is not WiRED's intention to provide specific medical advice to users of its modules. Instead we provide information to help users better understand health issues and the current approaches related to treatment, prevention, screening, and supportive care. WiRED urges users to consult with a qualified health care professional for diagnosis and answers to their personal medical questions."
            },
            {
                "type": "paragraph",
                "text": "Use of This Information"
            },
            {
                "type": "paragraph",
                "text": "WiRED does not charge NGOs, community groups and other not-for-profit organizations for the use of this Community Health Information database. However, any individual or group wishing to use this material must receive written permission from WiRED before the material can be copied or displayed. Moreover, no individual or group using this material may charge for access. The material from the WiRED modules may not be revised, extracted or used outside the context of the modules as they appear in the original database."
            },
            {
                "type": "paragraph",
                "text": "Contact Information"
            },
            {
                "type": "paragraph",
                "text": "WiRED International\nP.O. Box 371132\nMontara, CA 94037\nUSA\nEmail: CHIprogram@wiredinternational.org\nWeb: www.wiredinternational.org"
            }
        ]
    )