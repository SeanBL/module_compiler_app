For a specific doc
PYTHONPATH=src python -m module_compiler.compile_module --in data/raw/module_stage3B.docx

If only one doc is in the directory
PYTHONPATH=src python -m module_compiler.compile_module

To test the module in a browswer, navigate to the module and start the server
cd data/exports/<module_name>
python -m http.server 8000

open a browser and paste this url:
http://localhost:8000