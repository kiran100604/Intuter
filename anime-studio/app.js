// Mode switching
const modeButtons = document.querySelectorAll(".mode-btn");

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    // Remove active class from all buttons
    modeButtons.forEach((btn) => btn.classList.remove("active"));
    // Add active class to clicked button
    button.classList.add("active");

    const mode = button.textContent.trim();
    const mainContent = document.querySelector("main.main-content");
    const activeSubtopic = document.querySelector(".subtopic-item.active");
    const subtopicId = activeSubtopic ? activeSubtopic.dataset.id : null;

    if (!mainContent) return;

    // Clear any inline styles (fixes scroll freeze when switching from Reading Mode)
    mainContent.style.cssText = '';

    if (mode === "Reading Mode") {
      mainContent.classList.add('reading-mode');
      import("./reading-mode/pdfViewer.js").then((module) => {
        module.setupReadingMode(mainContent, chatManager);
      });
    } else {
      mainContent.classList.remove('reading-mode');
      if (mode === "Revision Mode") {
        import("./revision.js").then((module) => {
          module.setupRevisionMode(mainContent, subtopicId);
        });
      } else if (mode === "Learning Mode") {
        // Restore Learning Mode content
        if (subtopicId) {
          // If a subtopic is selected, show its content
          showSubtopicLearningContent(activeSubtopic);
        } else {
          // Otherwise show the default welcome message
          showMainContent();
        }
      }
    }
  });
});

// Chat functionality
import { ChatManager } from "./chatManager.js";
// Content feedback and notes
import { ContentFeedback } from "./contentFeedback.js";
import { NoteEditor } from "./noteEditor.js";
import { KnowledgePopup } from "./knowledgePopup.js";

let chatManager;
let contentFeedback;
let noteEditor;

document.addEventListener("DOMContentLoaded", () => {
  chatManager = new ChatManager();
  contentFeedback = new ContentFeedback();

  // Initialize note editor
  noteEditor = new NoteEditor("notes-container");

  // Setup sidebar tab switching
  setupSidebarTabs();
});

// Setup sidebar tabs (Chat / Notes)
function setupSidebarTabs() {
  const tabs = document.querySelectorAll(".sidebar-tab");
  const panels = document.querySelectorAll(".sidebar-panel");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetTab = tab.dataset.tab;

      // Update tab active states
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Update panel visibility
      panels.forEach((panel) => {
        if (panel.id === `${targetTab}-panel`) {
          panel.classList.add("active");
        } else {
          panel.classList.remove("active");
        }
      });

      // Load notes when notes tab is clicked
      if (targetTab === "notes" && noteEditor) {
        const activeSubtopic = document.querySelector(".subtopic-item.active");
        if (activeSubtopic) {
          noteEditor.init(activeSubtopic.dataset.id);
        } else {
          noteEditor.loadNotes();
        }
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  let user;
  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch (error) {
    console.error("Could not parse user from localStorage:", error);
    // If user data is critical, redirect to login. Otherwise, can proceed.
  }

  let sessionId = localStorage.getItem("sessionId");

  // Fetch sessions and populate the sidebar
  try {
    if (!sessionId) {
      const sessionsResponse = await fetch(
        "http://localhost:5000/api/sessions",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (sessionsResponse.ok) {
        const sessionsData = await sessionsResponse.json();
        if (sessionsData.data.sessions.length > 0) {
          sessionId = sessionsData.data.sessions[0].sessionId;
          localStorage.setItem("sessionId", sessionId);
        }
      }
    }

    if (sessionId) {
      const sessionDetailsResponse = await fetch(
        `http://localhost:5000/api/sessions/${sessionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (sessionDetailsResponse.ok) {
        const sessionDetailsData = await sessionDetailsResponse.json();

        populateSidebar(sessionDetailsData.data.session.topics);

        if (
          sessionDetailsData.data.session.topics &&
          sessionDetailsData.data.session.topics.length > 0
        ) {
          showMainContent();
        }
      }
    } else {
      // Show session creation form
      document.getElementById("session-creation").style.display = "block";
      document
        .getElementById("session-form")
        .addEventListener("submit", async (e) => {
          e.preventDefault();
          const subjectName = document.getElementById("subjectName").value;
          const goal = document.getElementById("goal").value;
          const outlineFile = document.getElementById("outline").files[0];

          // Show loading state
          showLoadingState("Creating session...");

          // Create FormData for file upload
          const formData = new FormData();
          formData.append("subjectName", subjectName);
          formData.append("goal", goal);
          if (outlineFile) {
            formData.append("outline", outlineFile);
          }

          try {
            const createSessionResponse = await fetch(
              "http://localhost:5000/api/sessions",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
                body: formData,
              },
            );

            if (createSessionResponse.ok) {
              const newSessionData = await createSessionResponse.json();
              localStorage.setItem(
                "sessionId",
                newSessionData.data.session.sessionId,
              );

              // If blueprint is already generated, show topics directly
              if (
                newSessionData.data.session.status === "ready" &&
                newSessionData.data.session.topicCount > 0
              ) {
                hideLoadingState();
                document.getElementById("session-creation").style.display =
                  "none";
                // Fetch and show topics
                const sessionDetailsResponse = await fetch(
                  `http://localhost:5000/api/sessions/${newSessionData.data.session.sessionId}`,
                  { headers: { Authorization: `Bearer ${token}` } },
                );
                if (sessionDetailsResponse.ok) {
                  const sessionDetails = await sessionDetailsResponse.json();
                  populateSidebar(sessionDetails.data.session.topics);
                  showMainContent();
                }
              } else {
                // Start polling for blueprint generation
                pollSessionGeneration(newSessionData.data.session.sessionId);
              }
            } else {
              hideLoadingState();
              const errorData = await createSessionResponse.json();
              showErrorMessage(
                `Error: ${errorData.message || "Failed to create session"}`,
              );
            }
          } catch (error) {
            hideLoadingState();
            showErrorMessage(
              `Error: ${error.message || "Network error occurred"}`,
            );
          }
        });
    }
  } catch (error) {
    console.error("Error fetching initial data:", error);
  }
});

function populateSidebar(topics) {
  const sidebarSection = document.querySelector(".sidebar-section");
  sidebarSection.innerHTML = '<div class="sidebar-label">Topics</div>'; // Clear existing topics

  if (!topics || topics.length === 0) {
    const noTopicsMessage = document.createElement("div");
    noTopicsMessage.className = "no-topics-message";
    noTopicsMessage.textContent = "No topics found for this session.";
    sidebarSection.appendChild(noTopicsMessage);
    return;
  }

  topics.forEach((topic) => {
    const topicGroup = document.createElement("div");
    topicGroup.className = "topic-group";

    const topicItem = document.createElement("div");
    topicItem.className = "topic-item";
    topicItem.innerHTML = `
            <button class="topic-toggle">
                <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                </svg>
            </button>
            <span>${topic.name}</span>
        `;

    const subtopicList = document.createElement("div");
    subtopicList.className = "subtopic-list";

    if (topic.subtopics && topic.subtopics.length > 0) {
      topic.subtopics.forEach((subtopic) => {
        const subtopicItem = document.createElement("div");
        subtopicItem.className = "subtopic-item";
        subtopicItem.dataset.id = subtopic.id;
        subtopicItem.innerHTML = `
                    <span class="dot"></span>
                    <span>${subtopic.name}</span>
                `;
        subtopicList.appendChild(subtopicItem);
      });
    }

    topicGroup.appendChild(topicItem);
    topicGroup.appendChild(subtopicList);
    sidebarSection.appendChild(topicGroup);
  });

  // Add event listeners to the new dynamic elements
  addDynamicEventListeners();
}

function addDynamicEventListeners() {
  const topicItems = document.querySelectorAll(".topic-item");
  topicItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      const topicGroup = item.closest(".topic-group");
      topicGroup.classList.toggle("expanded");
    });
  });

  const subtopicItems = document.querySelectorAll(".subtopic-item");
  subtopicItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      subtopicItems.forEach((sub) => sub.classList.remove("active"));
      item.classList.add("active");
      showSubtopicLearningContent(item);
      if (chatManager) chatManager.switchToSubtopic(item.dataset.id);
      // Initialize notes for this subtopic
      if (noteEditor) noteEditor.init(item.dataset.id);
    });
  });
}

// UI Utility Functions
function showLoadingState(message) {
  const existingLoader = document.querySelector(".loading-overlay");
  if (existingLoader) return;

  const loadingOverlay = document.createElement("div");
  loadingOverlay.className = "loading-overlay";
  loadingOverlay.innerHTML = `
    <div class="loading-content">
      <div class="spinner"></div>
      <div class="loading-message">${message}</div>
      <div class="progress-bar">
        <div class="progress-fill" id="progressFill"></div>
      </div>
    </div>
  `;
  document.body.appendChild(loadingOverlay);
}

function updateLoadingProgress(progress, message) {
  const progressFill = document.getElementById("progressFill");
  const loadingMessage = document.querySelector(".loading-message");
  if (progressFill) progressFill.style.width = `${progress}%`;
  if (loadingMessage) loadingMessage.textContent = message;
}

function hideLoadingState() {
  const loadingOverlay = document.querySelector(".loading-overlay");
  if (loadingOverlay) {
    loadingOverlay.remove();
  }
}

function showErrorMessage(message) {
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-message";
  errorDiv.textContent = message;
  errorDiv.style.position = "fixed";
  errorDiv.style.top = "20px";
  errorDiv.style.right = "20px";
  errorDiv.style.background = "#f44336";
  errorDiv.style.color = "white";
  errorDiv.style.padding = "12px 20px";
  errorDiv.style.borderRadius = "4px";
  errorDiv.style.zIndex = "9999";
  errorDiv.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";

  document.body.appendChild(errorDiv);

  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

function showMainContent() {
  const mainContent = document.querySelector("main.main-content");
  const sidebar = document.querySelector(".sidebar");

  if (mainContent) mainContent.style.display = "block";
  if (sidebar) sidebar.style.display = "block";

  // Show default message
  mainContent.innerHTML = `
    <div class="welcome-message">
      <h2>Welcome to your learning session</h2>
      <p>Select a subtopic from the sidebar to start learning.</p>
    </div>
  `;
}

// Session polling function
async function pollSessionGeneration(sessionId) {
  const token = localStorage.getItem("token");
  let attempts = 0;
  const maxAttempts = 60; // 2 minutes with 2-second intervals

  const poll = async () => {
    try {
      attempts++;

      const statusResponse = await fetch(
        `http://localhost:5000/api/sessions/${sessionId}/status`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();

        if (!statusData || !statusData.data) {
          // If statusData or its data property is null/undefined, stop polling.
          console.error("Polling received invalid status data.");
          hideLoadingState();
          showErrorMessage("Failed to get session status. Please refresh.");
          return;
        }

        const sessionStatus = statusData.data; // Use the nested data object

        if (sessionStatus.progress > 0) {
          updateLoadingProgress(
            sessionStatus.progress,
            `Generating topics... (${sessionStatus.topicCount} topics, ${sessionStatus.subtopicCount} subtopics)`,
          );
        }

        if (sessionStatus.status === "generation_failed") {
          hideLoadingState();
          showErrorMessage("Topic generation failed. Please try again.");
          return;
        }

        if (
          sessionStatus.status === "ready" &&
          sessionStatus.blueprintGenerated
        ) {
          hideLoadingState();
          document.getElementById("session-creation").style.display = "none";

          // Fetch and show topics
          const sessionDetailsResponse = await fetch(
            `http://localhost:5000/api/sessions/${sessionId}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );

          if (sessionDetailsResponse.ok) {
            const sessionDetails = await sessionDetailsResponse.json();
            populateSidebar(sessionDetails.data.session.topics); // Also update here
            showMainContent();
          }
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          hideLoadingState();
          showErrorMessage(
            "Topic generation is taking longer than expected. Please try refreshing the page.",
          );
        }
      } else {
        throw new Error("Failed to check session status");
      }
    } catch (error) {
      console.error("Polling error:", error);
      if (attempts < maxAttempts) {
        setTimeout(poll, 2000);
      } else {
        hideLoadingState();
        showErrorMessage(
          "Connection error. Please check your internet and try again.",
        );
      }
    }
  };

  poll();
}

async function showSubtopicLearningContent(subtopicItem) {
  const subtopicId = subtopicItem.dataset.id;
  const subtopicName =
    subtopicItem.querySelector("span:last-child").textContent;
  const mainContent = document.querySelector("main.main-content");
  const token = localStorage.getItem("token");

  mainContent.innerHTML = `
    <div class="subtopic-content">
      <h2 id="subtopic-title">${subtopicName}</h2>
      <div id="content-container">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;

  try {
    const response = await fetch(
      `http://localhost:5000/api/learning/progress/${subtopicId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
      },
    );

    if (response.ok) {
      const result = await response.json();
      const content = result.data.content;

      if (
        result.data.status === "completed" &&
        content &&
        Object.keys(content).length > 0
      ) {
        displayExistingContent(content, subtopicName);
      } else if (result.data.status === "generating") {
        // If generation is already in progress, start polling
        pollContentGenerationProgress(subtopicId, subtopicName);
      } else {
        // If no content, show start button
        showStartLearningButton(subtopicId, subtopicName);
      }
    } else if (response.status === 404) {
      // Progress not found, so no content has been generated
      showStartLearningButton(subtopicId, subtopicName);
    } else {
      // Handle other errors
      const errorData = await response.json();
      showErrorMessage(errorData.message || "Failed to fetch learning content");
      showStartLearningButton(subtopicId, subtopicName); // Fallback
    }
  } catch (error) {
    console.error("Error fetching subtopic content:", error);
    showErrorMessage("Network error. Please try again.");
    showStartLearningButton(subtopicId, subtopicName); // Fallback
  }
}

function showStartLearningButton(subtopicId, subtopicName) {
  const contentContainer = document.getElementById("content-container");
  if (!contentContainer) return;

  contentContainer.innerHTML = `
    <div class="learning-options">
      <div class="start-learning-btn" id="startLearningBtn">
        <h3>Ready to start learning?</h3>
        <p>Click to generate personalized learning content for this topic.</p>
        <button class="btn-primary">Start Learning</button>
      </div>
    </div>
  `;

  document.getElementById("startLearningBtn").addEventListener("click", () => {
    startLearningContentGeneration(subtopicId, subtopicName);
  });
}

function displayExistingContent(content, subtopicName) {
  const contentContainer = document.getElementById("content-container");
  if (!contentContainer) return;

  // Since displayGeneratedContent uses 'generated-content-container',
  // let's provide that element.
  contentContainer.innerHTML =
    '<div class="content-sections"><div id="generated-content-container"></div></div>';
  displayGeneratedContent(content, subtopicName);
}

// Start learning content generation
async function startLearningContentGeneration(subtopicId, subtopicName) {
  const token = localStorage.getItem("token");
  const sessionId = localStorage.getItem("sessionId");

  if (!token || !sessionId) {
    showErrorMessage("Please log in and select a session first");
    return;
  }

  const contentContainer = document.getElementById("content-container");
  if (contentContainer) {
    contentContainer.innerHTML = `
      <div class="content-generation-progress">
        <h3>Generating Narrative Content</h3>
        <p class="progress-text" id="progressText">Initializing generation...</p>
        <div class="progress-bar-container">
          <div class="progress-bar-content" id="contentProgress" style="width: 10%;"></div>
        </div>
      </div>
      <div id="generated-content-container"></div>
    `;
  }

  try {
    const response = await fetch(
      "http://localhost:5000/api/learning/content/generate-learning",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subtopicId, sessionId }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to start content generation");
    }

    pollContentGenerationProgress(subtopicId, subtopicName);
  } catch (error) {
    console.error("Error starting content generation:", error);
    showErrorMessage(`Error: ${error.message}`);
    showStartLearningButton(subtopicId, subtopicName);
  }
}

async function pollContentGenerationProgress(subtopicId, subtopicName) {
  const token = localStorage.getItem("token");
  let attempts = 0;
  const maxAttempts = 120; // 4 minutes

  const poll = async () => {
    if (attempts++ >= maxAttempts) {
      showErrorMessage("Content generation timed out.");
      showStartLearningButton(subtopicId, subtopicName);
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/learning/progress/${subtopicId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        },
      );

      if (!response.ok) throw new Error("Failed to check progress");

      const result = await response.json();
      const progressData = result.data;

      const progressBar = document.getElementById("contentProgress");
      const progressText = document.getElementById("progressText");

      if (progressBar)
        progressBar.style.width = `${progressData.progress || 10}%`;
      if (progressText)
        progressText.textContent = `Status: ${progressData.currentStep}...`;

      if (progressData.status === "completed") {
        if (progressBar) progressBar.style.width = `100%`;
        if (progressText) progressText.textContent = `Content ready!`;
        displayGeneratedContent(progressData.content, subtopicName);
        return;
      }

      if (progressData.status === "error") {
        throw new Error(progressData.error || "Content generation failed");
      }

      setTimeout(poll, 2000);
    } catch (error) {
      console.error("Polling error:", error);
      showErrorMessage(`Error: ${error.message}`);
      showStartLearningButton(subtopicId, subtopicName);
    }
  };

  poll();
}

function displayGeneratedContent(content, subtopicName) {
  // Hide progress bar if it exists
  const progressIndicator = document.querySelector(
    ".content-generation-progress",
  );
  if (progressIndicator) {
    progressIndicator.style.display = "none";
  }

  const container = document.getElementById("generated-content-container");
  if (!container) return;

  // Ensure the container is visible
  container.style.display = "block";

  // Get feedback bar HTML from ContentFeedback component
  const feedbackBarHtml = window.contentFeedback ? window.contentFeedback.createFeedbackBar() : '';

  const contentHtml = `
    <div class="generated-content-narrative">

      ${content.story
      ? `
        <div class="story-section callout info">
            <div class="callout-icon">💡</div>
            <div class="callout-content">
                <div class="callout-title">Basic Intro..</div>
                <div class="callout-text">${formatLearningContent(content.story)}</div>
            </div>
        </div>
      `
      : ""
    }

      ${content.theory
      ? `
        <div class="theory-section">
          <h3>Theory & Concepts</h3>
          <div class="content-body">${formatLearningContent(content.theory)}</div>
        </div>
      `
      : ""
    }

      ${content.summary
      ? `
        <div class="summary-section callout tip">
            <div class="callout-icon">✅</div>
            <div class="callout-content">
                <div class="callout-title">Summary</div>
                <div class="callout-text">${formatLearningContent(content.summary)}</div>
            </div>
        </div>
      `
      : ""
    }

      ${feedbackBarHtml}

    </div>
  `;

  container.innerHTML = contentHtml;

  // Render math expressions
  renderMathInElement(container, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false },
    ],
  });

  // Process knowledge tags to make them clickable
  if (window.KnowledgePopup && window.KnowledgePopup.processTagsInContent) {
    window.KnowledgePopup.processTagsInContent(container);
  }

  // Update content feedback with current subtopic
  const activeSubtopic = document.querySelector(".subtopic-item.active");
  if (activeSubtopic && window.contentFeedback) {
    window.contentFeedback.init(activeSubtopic.dataset.id);
  }

  const mainContent = document.querySelector("main.main-content");
  mainContent.scrollTop = 0;
}

function formatLearningContent(text) {
  if (!text) return "";

  let html = text;
  const callouts = [];

  // NEW: Convert vector notation to LaTeX BEFORE processing code blocks or callouts
  // Handle vectors like v₁ = [1, 2, 3]ᵀ
  html = html.replace(
    /([a-zA-Z])([₀₁₂₃₄₅₆₇₈₉]+)\s*=\s*\[([^\]]+)\]ᵀ/g,
    (match, variable, subscript, values) => {
      const subscriptMap = {
        "₀": "0",
        "₁": "1",
        "₂": "2",
        "₃": "3",
        "₄": "4",
        "₅": "5",
        "₆": "6",
        "₇": "7",
        "₈": "8",
        "₉": "9",
      };
      const normalSubscript = subscript
        .split("")
        .map((c) => subscriptMap[c] || c)
        .join("");
      const valuesFormatted = values
        .split(",")
        .map((v) => v.trim())
        .join(", ");
      return `$${variable}_{${normalSubscript}} = \\begin{bmatrix} ${valuesFormatted} \\end{bmatrix}^T$`;
    },
  );

  // Handle matrix equations like Ac = 0
  html = html.replace(/([A-Z])([a-z])\s*=\s*([0-9]+)/g, "$$$1$2 = $3$$");

  // Handle subscripted variables in equations (c₁, c₂, etc.)
  html = html.replace(
    /([a-z])([₀₁₂₃₄₅₆₇₈₉]+)/g,
    (match, variable, subscript) => {
      const subscriptMap = {
        "₀": "0",
        "₁": "1",
        "₂": "2",
        "₃": "3",
        "₄": "4",
        "₅": "5",
        "₆": "6",
        "₇": "7",
        "₈": "8",
        "₉": "9",
      };
      const normalSubscript = subscript
        .split("")
        .map((c) => subscriptMap[c] || c)
        .join("");
      return `$${variable}_{${normalSubscript}}$`;
    },
  );

  // 1. Process Pedagogical Elements (Callouts) using a State Machine Parser
  // This is more robust than regex for handling nested content, missing markers, and multi-line blocks.

  const lines = html.split(/\r?\n/);
  const processedLines = [];
  let currentCard = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check for Card Start
    // Matches: 
    // 1. Optional Indentation/Blockquote/Headers
    // 2. Optional Emojis (Captured in Group 1) - Exclude | to avoid matching table rows
    // 3. Optional Bold markers
    // 4. Title/Type (Captured in Group 2)
    // 5. Colon
    const cardStartMatch = line.match(/^\s*(?:#+\s*)?(?:>\s*)?([^\w\s\*\|]+)?\s*(?:\*\*)?([^\*:]+)(?:\*\*)?[:]/);

    // DEBUG: Log lines that look like cards but fail matching
    if (!cardStartMatch && (line.includes("Key Definition") || line.includes("Pro Tip") || line.includes("Common Pitfall"))) {
      console.log("DEBUG: Suspicious line failed regex:", JSON.stringify(line));
    }

    if (cardStartMatch) {
      const capturedIcon = cardStartMatch[1] ? cardStartMatch[1].trim() : null;
      let boldContent = cardStartMatch[2];

      const parts = boldContent.split(":");
      const possibleType = parts[0].trim().toLowerCase();

      let isKnownType = false;
      let calloutClass = "info";
      let icon = capturedIcon || "💡"; // Use captured icon if available, else default

      if (possibleType.includes("definition")) {
        calloutClass = "definition";
        icon = "🔑";
        isKnownType = true;
      } else if (possibleType.includes("insight") || possibleType.includes("intuition") || possibleType.includes("analogy")) {
        calloutClass = "insight";
        icon = "✨";
        isKnownType = true;
      } else if (possibleType.includes("pitfall")) {
        calloutClass = "pitfall";
        icon = "⚠️";
        isKnownType = true;
      } else if (possibleType.includes("example") || possibleType.includes("problem") || possibleType.includes("exercise")) {
        calloutClass = "example";
        icon = "🔬";
        isKnownType = true;
      } else if (possibleType.includes("tip")) {
        calloutClass = "tip";
        icon = "💡";
        isKnownType = true;
      } else if (possibleType.includes("warning")) {
        calloutClass = "pitfall"; // Map warning to pitfall
        icon = "⚠️";
        isKnownType = true;
      } else if (capturedIcon) {
        // Generic catch-all: If we captured an icon but didn't match a known type,
        // treat it as a generic card using the captured icon.
        isKnownType = true;
        // Keep default calloutClass = "info" and icon = capturedIcon
      }

      if (isKnownType) {
        if (currentCard) {
          const newTitleLower = parts[0].trim().toLowerCase();

          // If the new title is "Problem" or "Solution" or "Given", treat as content.
          if (newTitleLower.includes("problem") || newTitleLower.includes("solution") || newTitleLower.includes("given") || newTitleLower.includes("step")) {
            // Treat as content
            const cleanLine = line.replace(/^\s*(?:#+\s*)?(?:>\s*)?/, ""); // Remove indentation/blockquote/header
            currentCard.content.push(cleanLine);
            continue; // Skip starting a new card
          }
        }

        // If we were already in a card (and didn't merge), close it
        if (currentCard) {
          processedLines.push(renderCard(currentCard));
          currentCard = null;
        }

        // Start new card
        let title = parts[0].trim();
        if (parts.length > 1) {
          title = parts.slice(1).join(":").trim();
          if (!title) title = parts[0].trim();
        }

        // The rest of the line might be content
        // We need to be careful. match[0] is the whole match prefix.
        let restOfLine = line.substring(cardStartMatch[0].length).trim();

        currentCard = {
          class: calloutClass,
          icon: icon,
          title: title,
          content: []
        };

        if (restOfLine) {
          currentCard.content.push(restOfLine);
        }
        continue; // Move to next line
      }
    }

    // Check for Card Termination Conditions
    // 1. Header (### ...)
    // 2. Horizontal Rule (---)
    // 3. Double Newline followed by something that looks like a start of a new section? 
    //    Actually, we want to be greedy. We only stop if we hit a Header or HR.
    //    Or if we hit another Card Start (handled above).

    if (currentCard) {
      if (trimmedLine.startsWith("#") || trimmedLine.startsWith("---")) {
        // Close card
        processedLines.push(renderCard(currentCard));
        currentCard = null;
        processedLines.push(line); // Add the header/hr
      } else {
        // Add to current card content
        // Remove leading > if present (for blockquote style compatibility)
        const cleanLine = line.replace(/^>\s?/, "");
        currentCard.content.push(cleanLine);
      }
    } else {
      processedLines.push(line);
    }
  }

  // Close any open card at the end
  if (currentCard) {
    processedLines.push(renderCard(currentCard));
  }

  html = processedLines.join("\n");

  function renderCard(card) {
    const contentText = card.content.join("\n").trim();
    const processedContent = processMarkdown(contentText);
    return `<div class="callout ${card.class}"><div class="callout-icon">${card.icon}</div><div class="callout-content"><div class="callout-title">${card.title}</div><div class="callout-text">${processedContent}</div></div></div>`;
  }

  // 2. Process remaining markdown for the rest of the text
  html = processMarkdown(html);

  // 3. Restore callouts
  html = html.replace(/\[\[CALLOUT_(\d+)\]\]/g, (match, index) => {
    // The placeholder might be wrapped in <p> by processMarkdown, so we need to handle that?
    // processMarkdown checks for <div... but our placeholder is [[CALLOUT_X]].
    // So it WILL be wrapped in <p>[[CALLOUT_X]]</p>.
    // We should strip the <p> tags if they exist around the placeholder.
    return callouts[parseInt(index)];
  });

  // Cleanup <p> wrapping around callouts if it happened
  // The replace above puts the div back.
  // If it was <p>[[CALLOUT_0]]</p>, it becomes <p><div...>...</div></p>.
  // We need to fix this invalid HTML.
  html = html.replace(/<p>\s*(<div class="callout".*?<\/div>)\s*<\/p>/gs, "$1");

  return html;
}

// Helper function to process standard markdown
function processMarkdown(text) {
  let html = text;

  // Tables
  // Matches:
  // | Header | Header |
  // | --- | --- |
  // | Cell | Cell |
  const tableRegex = /^\|(.+)\|\n\|([-:| ]+)\|\n((?:\|.*\|\n?)+)/gm;

  html = html.replace(tableRegex, (match, header, separator, body) => {
    const headers = header.split("|").map(h => h.trim()).filter(h => h);
    const rows = body.trim().split("\n");

    const headerHtml = headers.map(h => `<th>${h}</th>`).join("");

    const bodyHtml = rows.map(row => {
      const cells = row.split("|").filter((c, i, arr) => i > 0 && i < arr.length - 1); // Remove first and last empty splits from |...|
      // Fallback if split logic is slightly off due to regex
      const cleanCells = cells.length > 0 ? cells : row.split("|").map(c => c.trim()).filter(c => c);

      return `<tr>${cleanCells.map(c => `<td>${c.trim()}</td>`).join("")}</tr>`;
    }).join("");

    return `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>${headerHtml}</tr>
          </thead>
          <tbody>
            ${bodyHtml}
          </tbody>
        </table>
      </div>
    `;
  });

  // Process matrix and code blocks
  html = html.replace(/```(\w*)?\n([\s\S]*?)\n```/g, (match, lang, code) => {
    if (
      lang === "matrix" ||
      (!lang && code.includes("[") && code.includes("]"))
    ) {
      return convertMatrixToLatex(code);
    } else {
      lang = lang || "text";
      return `
              <div class="code-block">
                  <div class="code-header">
                      <span class="code-language">${lang}</span>
                      <div class="code-actions">
                          <button class="code-action-btn">Copy</button>
                      </div>
                  </div>
                  <div class="code-content"><pre><code>${escapeHtml(code.trim())}</code></pre></div>
              </div>
          `;
    }
  });

  // Headings
  html = html.replace(/^#### (.*$)/gim, "<h5>$1</h5>");
  html = html.replace(/^### (.*$)/gim, "<h4>$1</h4>");
  html = html.replace(/^## (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^# (.*$)/gim, "<h2>$1</h2>");

  // Bold and Italics
  html = html.replace(/\*\*(?!\$)(.*?)(?<!\$)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(?!\$)(.*?)(?<!\$)\*/g, "<em>$1</em>");

  // Lists
  html = html.replace(/^\s*[-*] (.*)/gm, "<ul><li>$1</li></ul>");
  html = html.replace(/<\/ul>\n<ul>/g, "");

  // Numbered Lists (Simple support)
  html = html.replace(/^\s*\d+\.\s+(.*)/gm, "<ol><li>$1</li></ol>");
  html = html.replace(/<\/ol>\n<ol>/g, "");

  // Blockquotes
  html = html.replace(/^> (.*$)/gim, "<blockquote>$1</blockquote>");

  // Paragraphs
  html = html
    .split("\n\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => {
      if (p.startsWith("<") && p.endsWith(">") && !p.startsWith("<p")) return p;
      if (p.startsWith("$$") || p.includes("$$")) return p;
      if (p.startsWith("$") && p.endsWith("$")) return p;
      // Check if it's a placeholder
      if (p.match(/^\[\[CALLOUT_\d+\]\]$/)) return p;
      return `<p>${p.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n\n");



  return html;
}

function convertMatrixToLatex(code) {
  const rows = code.trim().split("\n");
  let latexMatrix = "$$\n";

  // Check if this is an augmented matrix with | separator
  if (rows.every((row) => row.includes("|"))) {
    const firstRow = rows[0].split("|")[0].trim();
    const numCols =
      firstRow
        .match(/\[([^\]]+)\]/)?.[1]
        .split(/[,\s]+/)
        .filter((x) => x).length ||
      firstRow.split(/\s+/).filter((x) => x && x !== "[" && x !== "]").length;

    latexMatrix += `\\left[\\begin{array}{${"c".repeat(numCols)}|c}\n`;
    rows.forEach((row) => {
      const parts = row.split("|");
      const left = parts[0]
        .trim()
        .replace(/\[|\]/g, "")
        .replace(/,/g, "")
        .replace(/\s+/g, " & ");
      const right = parts[1].trim().replace(/\[|\]/g, "");
      latexMatrix += `${left} & ${right} \\\\\n`;
    });
    latexMatrix += "\\end{array}\\right]";
  }
  // Check if this is a matrix equation (contains = or multiple matrices)
  else if (rows.some((row) => row.includes("="))) {
    rows.forEach((row) => {
      // Split by = to handle equations
      const parts = row.split("=");
      const processedParts = parts.map((part) => {
        // Extract matrix content
        const matrixMatch = part.match(/\[([^\]]+)\]/g);
        if (matrixMatch) {
          return matrixMatch
            .map((m) => {
              const values = m
                .replace(/\[|\]/g, "")
                .split(/[,\s]+/)
                .filter((x) => x)
                .join(" & ");
              return `\\begin{bmatrix} ${values} \\end{bmatrix}`;
            })
            .join(" ");
        }
        return part.trim();
      });
      latexMatrix += processedParts.join(" = ") + "\\\\\n";
    });
  }
  // Simple matrix or column vectors
  else {
    latexMatrix += "\\begin{bmatrix}\n";
    rows.forEach((row) => {
      const cleaned = row
        .trim()
        .replace(/\[|\]/g, "")
        .replace(/,/g, "")
        .replace(/\s+/g, " & ");
      latexMatrix += cleaned + " \\\\\n";
    });
    latexMatrix += "\\end{bmatrix}";
  }

  latexMatrix += "\n$$";
  return latexMatrix;
}

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Copy code functionality
document.addEventListener("click", function (e) {
  if (
    e.target.classList.contains("code-action-btn") ||
    e.target.closest(".code-action-btn")
  ) {
    const btn = e.target.classList.contains("code-action-btn")
      ? e.target
      : e.target.closest(".code-action-btn");
    const codeBlock = btn.closest(".code-block");
    const code = codeBlock.querySelector("code").textContent;

    navigator.clipboard.writeText(code).then(() => {
      const originalText = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    });
  }
});
