Use this command to run the app:
python app.py


Use this command to build the EXE:

python -m PyInstaller --onefile \
--hidden-import=module_compiler \
--hidden-import=docx \
--hidden-import=pydantic \
--hidden-import=PIL \
--collect-all pydantic \
--collect-all PIL \
--add-data "templates;templates" \
--add-data "static;static" \
--add-data "healthmap_module_compiler;healthmap_module_compiler" \
--add-data "healthmap_module_compiler/src/module_compiler;module_compiler" \
app.py