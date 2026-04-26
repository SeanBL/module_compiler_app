document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector(".build-form");
  const fileInput = document.getElementById("zip_file");
  const selectedFile = document.getElementById("selected-file");
  const dropZone = document.getElementById("drop-zone");

  const progressContainer = document.getElementById("upload-progress-container");
  const progressBar = document.getElementById("upload-progress-bar");
  const progressText = document.getElementById("upload-progress-text");

  if (!form || !fileInput || !selectedFile || !dropZone) return;

  function setSelectedFile(file) {
    selectedFile.textContent = "Selected file: " + file.name;
    dropZone.querySelector(".drop-text").textContent = "✅ File ready!";
    dropZone.querySelector(".drop-subtext").textContent = "Ready to build";
  }

  dropZone.addEventListener("click", function () {
    fileInput.click();
  });

  fileInput.addEventListener("change", function () {
    if (fileInput.files.length > 0) {
      setSelectedFile(fileInput.files[0]);
    }
  });

  ["dragenter", "dragover"].forEach(function (eventName) {
    dropZone.addEventListener(eventName, function (e) {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
  });

  ["dragleave"].forEach(function (eventName) {
    dropZone.addEventListener(eventName, function (e) {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    });
  });

  dropZone.addEventListener("drop", function (e) {
    e.preventDefault();
    dropZone.classList.remove("dragover");

    const files = e.dataTransfer.files;

    if (files && files.length > 0) {
      fileInput.files = files; // 👈 simpler + more reliable
      setSelectedFile(files[0]);
    }
  });

  // ✅ Prevent browser from opening dropped files
  window.addEventListener("dragover", function (e) {
    e.preventDefault();
  });

  window.addEventListener("drop", function (e) {
    e.preventDefault();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!fileInput.files.length) {
      selectedFile.textContent = "Please select a ZIP file first.";
      return;
    }

    const formData = new FormData(form);
    const xhr = new XMLHttpRequest();

    xhr.open("POST", form.action, true);

    if (progressContainer && progressBar && progressText) {
      progressContainer.style.display = "block";
      progressBar.style.width = "0%";
      progressText.innerHTML = 'Uploading... <span class="spinner"></span>';
    }

    xhr.upload.addEventListener("progress", function (e) {
      if (e.lengthComputable && progressBar && progressText) {
        const percent = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = percent + "%";
        progressText.innerHTML = `Uploading... ${percent}% <span class="spinner"></span>`;
      }
    });

    xhr.onload = function () {
      if (xhr.status === 200) {
        if (progressText) {
          progressText.innerHTML = 'Processing module... <span class="spinner"></span>';
          progressContainer.classList.add("processing");
        }

        // Small delay so user sees the message
        setTimeout(() => {
          document.open();
          document.write(xhr.responseText);
          document.close();
        }, 500);

      } else {
        if (progressText) progressText.textContent = "Upload failed.";
      }
    };

    xhr.onerror = function () {
      if (progressText) progressText.textContent = "Upload failed.";
    };

    xhr.send(formData);
  });
});