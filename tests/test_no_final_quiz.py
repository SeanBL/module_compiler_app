import contextlib
import importlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

from docx import Document

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "healthmap_module_compiler" / "src"))
compiler = importlib.import_module("module_compiler.compile_module")
from module_compiler.stage1.structural_extractor import extract_raw_slides


class NoFinalQuizTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.input = Path(self.temp.name) / "blueprint.docx"
        self.output = Path(self.temp.name) / "module.json"
        self.doc = Document()
        self.doc.add_paragraph("Module title: Test module")
        self.doc.add_paragraph("Module id: 123")

    def panel(self, notes="", english="Panel content"):
        table = self.doc.add_table(rows=3, cols=3)
        table.cell(0, 0).text = "Header: Panel"
        for cell, text in zip(table.rows[1].cells, ["English", "Answer", "Notes"]):
            cell.text = text
        table.cell(2, 0).text = english
        table.cell(2, 2).text = notes

    def quiz(self, scope, notes=""):
        self.doc.add_paragraph(f"quiz_mcq_{scope}")
        table = self.doc.add_table(rows=2, cols=3)
        table.cell(0, 0).text = f"{scope} question?\nA. Yes\nB. No"
        table.cell(0, 1).text = "Answer: A\nExplanation"
        # The empty question row takes an early exit in quiz parsing.
        table.cell(1, 2).text = notes

    def extract(self):
        self.doc.save(self.input)
        with contextlib.redirect_stdout(io.StringIO()):
            return extract_raw_slides(self.input)

    def compile(self):
        self.doc.save(self.input)
        with (
            contextlib.redirect_stdout(io.StringIO()),
            patch.object(compiler, "generate_annotated_doc"),
            patch.object(compiler, "package_runtime") as package,
            patch.object(compiler, "build_final_quiz", wraps=compiler.build_final_quiz) as builder,
        ):
            compiler.compile_module(self.input, self.output)
        package.assert_called_once()
        return json.loads(self.output.read_text(encoding="utf-8")), builder

    def test_default_automatic_final_quiz(self):
        self.panel()
        self.quiz("inline")
        self.assertFalse(self.extract()["no_final_quiz"])
        data, builder = self.compile()
        self.assertTrue(builder.call_args.kwargs["include_inline"])
        self.assertEqual([s["quiz_scope"] for s in data["slides"] if s["type"] == "quiz"], ["inline", "final"])

    def test_suppression_preserves_inline_and_application_questions(self):
        self.panel("[[NO_FINAL_QUIZ]]")
        self.quiz("inline")
        self.quiz("application")
        data, builder = self.compile()
        self.assertFalse(builder.call_args.kwargs["include_inline"])
        quizzes = [s for s in data["slides"] if s["type"] == "quiz"]
        self.assertEqual([s["quiz_scope"] for s in quizzes], ["inline", "application"])
        for slide in quizzes:
            question = slide["questions"][0]
            self.assertEqual(question["correct_option_id"], "A")
            self.assertEqual(len(question["options"]), 2)
            self.assertEqual(question["explanation"], "Explanation")

    def test_explicit_final_conflict_before_assembly_or_packaging(self):
        self.panel("[[NO_FINAL_QUIZ]]")
        self.quiz("final")
        with self.assertRaisesRegex(RuntimeError, "NO_FINAL_QUIZ.*explicitly authored final quiz"):
            self.compile()
        self.assertFalse(self.output.exists())

    def test_mixed_case_and_repeated_commands(self):
        self.panel("Other notes [[nO_fInAl_QuIz]]\n[[NO_FINAL_QUIZ]]")
        self.panel("[[no_final_quiz]]")
        self.assertTrue(self.extract()["no_final_quiz"])

    def test_late_command_applies_to_earlier_inline_quiz(self):
        self.panel()
        self.quiz("inline")
        self.panel("[[NO_FINAL_QUIZ]]")
        data, _ = self.compile()
        self.assertEqual([s["quiz_scope"] for s in data["slides"] if s["type"] == "quiz"], ["inline"])

    def test_notes_command_before_quiz_empty_row_early_exit(self):
        self.panel()
        self.quiz("inline", "[[NO_FINAL_QUIZ]]")
        self.assertTrue(self.extract()["no_final_quiz"])
        data, _ = self.compile()
        self.assertFalse(any(s.get("quiz_scope") == "final" for s in data["slides"]))

    def test_english_token_is_visible_content_not_a_command(self):
        self.panel(english="Example [[NO_FINAL_QUIZ]]")
        self.quiz("inline")
        self.assertFalse(self.extract()["no_final_quiz"])
        data, _ = self.compile()
        self.assertIn("[[NO_FINAL_QUIZ]]", data["slides"][0]["body"][0]["text"])
        self.assertTrue(any(s.get("quiz_scope") == "final" for s in data["slides"]))

    def test_incomplete_notes_token_does_not_disable_final(self):
        self.panel("[NO_FINAL_QUIZ] [[NO_FINAL_QUIZ_EXTRA]]")
        self.assertFalse(self.extract()["no_final_quiz"])

    def test_explicit_final_without_command_still_merges_inline(self):
        self.panel()
        self.quiz("inline")
        self.quiz("final")
        data, _ = self.compile()
        finals = [s for s in data["slides"] if s.get("quiz_scope") == "final"]
        self.assertEqual(len(finals), 2)


if __name__ == "__main__":
    unittest.main()
