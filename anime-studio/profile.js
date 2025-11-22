document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const sessionsList = document.getElementById("sessions-list");
  const sessionForm = document.getElementById("session-form");
  const fileInput = document.getElementById("outline");
  const fileDropZone = document.getElementById("fileDropZone");
  const fileUploadWrapper = document.getElementById("fileUploadWrapper");
  const filePreview = document.getElementById("filePreview");
  const fileName = document.getElementById("fileName");
  const fileSize = document.getElementById("fileSize");
  const removeFileBtn = document.getElementById("removeFile");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const loadingMessage = document.getElementById("loadingMessage");
  const progressFill = document.getElementById("progressFill");
  const submitBtn = document.getElementById("submitBtn");

  let selectedFile = null;

  // Mode buttons functionality
  const modeButtons = document.querySelectorAll(".mode-btn");
  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      if (btn.textContent.includes("Reading Mode")) {
        // Implement reading mode navigation
        window.location.href = "index.html?mode=reading";
      }
    });
  });

  // File upload functionality
  function handleFileSelect(file) {
    if (!file) return;

    // Validate file type
    if (file.type !== "application/pdf") {
      showError("Please select a PDF file.");
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      showError("File size exceeds 10MB limit.");
      return;
    }

    selectedFile = file;
    displayFilePreview(file);
  }

  function displayFilePreview(file) {
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileUploadWrapper.style.display = "none";
    filePreview.style.display = "flex";
  }

  function clearFileSelection() {
    selectedFile = null;
    fileInput.value = "";
    fileUploadWrapper.style.display = "block";
    filePreview.style.display = "none";
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  function showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-toast";
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
      errorDiv.style.animation = "slideOut 0.3s ease";
      setTimeout(() => errorDiv.remove(), 300);
    }, 3000);
  }

  // File input change handler
  fileInput.addEventListener("change", (e) => {
    handleFileSelect(e.target.files[0]);
  });

  // Drag and drop handlers
  fileDropZone.addEventListener("click", () => {
    fileInput.click();
  });

  fileDropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    fileDropZone.style.borderColor = "#ff6b35";
    fileDropZone.style.backgroundColor = "rgba(255, 107, 53, 0.1)";
  });

  fileDropZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    fileDropZone.style.borderColor = "#333333";
    fileDropZone.style.backgroundColor = "transparent";
  });

  fileDropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    fileDropZone.style.borderColor = "#333333";
    fileDropZone.style.backgroundColor = "transparent";
    handleFileSelect(e.dataTransfer.files[0]);
  });

  // Remove file handler
  removeFileBtn.addEventListener("click", () => {
    clearFileSelection();
  });

  async function fetchAndDisplaySessions() {
    try {
      const response = await fetch("http://localhost:5000/api/sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch sessions");
      }

      const data = await response.json();
      const sessions = data.data.sessions;
      sessionsList.innerHTML = ""; // Clear existing list

      if (sessions.length === 0) {
        sessionsList.innerHTML = `
          <div class="no-sessions-message">
            <div class="no-sessions-icon">📚</div>
            <h3>No study sessions yet</h3>
            <p>Create your first learning session below to get started!</p>
          </div>
        `;
      } else {
        sessions.forEach((session) => {
          const sessionElement = document.createElement("div");
          sessionElement.className = "session-card";
          const createdDate = new Date(
            session.createdDate,
          ).toLocaleDateString();
          const hasTopics = session.topicCount > 0;

          sessionElement.innerHTML = `
            <div class="session-header">
              <div class="session-info">
                <h3>${session.subjectName}</h3>
                <p class="session-goal">${session.goal}</p>
              </div>
              <div class="session-status">
                ${hasTopics ? '<span class="status-badge ready">✓ Ready</span>' : '<span class="status-badge setup">Setup</span>'}
              </div>
            </div>
            <div class="session-footer">
              <span class="session-date">Created ${createdDate}</span>
              ${hasTopics ? `<span class="session-topics">${session.topicCount} topics</span>` : ""}
            </div>
          `;

          sessionElement.addEventListener("click", () => {
            localStorage.setItem("sessionId", session.sessionId);
            window.location.href = "index.html";
          });
          sessionsList.appendChild(sessionElement);
        });
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
      sessionsList.innerHTML = `
        <div class="error-message">
          <div class="error-icon">⚠️</div>
          <h3>Connection Error</h3>
          <p>Unable to load sessions. Please check your connection and try again.</p>
        </div>
      `;
    }
  }

  sessionForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const subjectName = document.getElementById("subjectName").value.trim();
    const goal = document.getElementById("goal").value.trim();

    // Form validation
    if (!subjectName || !goal) {
      showError("Please fill in all required fields.");
      return;
    }

    // Show loading state
    loadingOverlay.style.display = "flex";
    loadingMessage.textContent = selectedFile
      ? "Creating session and processing PDF..."
      : "Creating session...";
    progressFill.style.width = "20%";
    submitBtn.disabled = true;
    submitBtn.querySelector(".btn-text").textContent = "Creating...";

    try {
      const formData = new FormData();
      formData.append("subjectName", subjectName);
      formData.append("goal", goal);
      if (selectedFile) {
        formData.append("outline", selectedFile);
      }

      const response = await fetch("http://localhost:5000/api/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type header - browser sets it with boundary for FormData
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create session");
      }

      const newSessionData = await response.json();
      progressFill.style.width = "100%";

      // If blueprint is being generated, show progress
      if (newSessionData.session.status === "generating_blueprint") {
        loadingMessage.textContent = "Generating topics and subtopics...";
        await pollSessionGeneration(newSessionData.session.sessionId);
      } else {
        // Session ready immediately
        loadingMessage.textContent = "Session created successfully!";
        setTimeout(() => {
          localStorage.setItem("sessionId", newSessionData.session.sessionId);
          window.location.href = "index.html";
        }, 1500);
      }
    } catch (error) {
      console.error("Error creating session:", error);
      showError(`Error: ${error.message}`);
      hideLoadingState();
    }
  });

  function hideLoadingState() {
    loadingOverlay.style.display = "none";
    progressFill.style.width = "0%";
    submitBtn.disabled = false;
    submitBtn.querySelector(".btn-text").textContent = "Create Session";
  }

  async function pollSessionGeneration(sessionId) {
    const maxAttempts = 60; // 2 minutes with 2-second intervals

    const poll = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/sessions/${sessionId}/status`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (response.ok) {
          const statusData = await response.json();
          const progress = Math.min(statusData.progress || 0, 90);

          progressFill.style.width = `${progress}%`;
          loadingMessage.textContent = `Generating topics... (${statusData.topicCount || 0} topics, ${statusData.subtopicCount || 0} subtopics)`;

          if (statusData.status === "ready" && statusData.blueprintGenerated) {
            loadingMessage.textContent = "Session ready!";
            progressFill.style.width = "100%";
            setTimeout(() => {
              localStorage.setItem("sessionId", sessionId);
              window.location.href = "index.html";
            }, 1000);
            return;
          }

          if (statusData.status === "error" || statusData.error) {
            throw new Error(statusData.error || "Topic generation failed");
          }

          setTimeout(poll, 2000);
        } else {
          throw new Error("Failed to check session status");
        }
      } catch (error) {
        console.error("Polling error:", error);
        showError(`Error: ${error.message}`);
        hideLoadingState();
      }
    };

    poll();
  }

  // Add CSS animations
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
    .error-toast {
      font-size: 14px;
      font-weight: 500;
    }
  `;
  document.head.appendChild(style);

  // Initial load
  fetchAndDisplaySessions();
});
