document.addEventListener("DOMContentLoaded", function () {
  const fileInput = document.getElementById("docx_file");
  const selectedFile = document.getElementById("selected-file");

  if (fileInput && selectedFile) {
    fileInput.addEventListener("change", function () {
      if (fileInput.files.length > 0) {
        selectedFile.textContent = "Selected file: " + fileInput.files[0].name;
      } else {
        selectedFile.textContent = "No file selected";
      }
    });
  }
});