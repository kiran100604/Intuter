// Mode switching
const modeButtons = document.querySelectorAll(".mode-btn");

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    // Remove active class from all buttons
    modeButtons.forEach((btn) => btn.classList.remove("active"));
    // Add active class to clicked button
    button.classList.add("active");

    // Reading Mode integration
    if (button.textContent.trim() === "Reading Mode") {
      // Only replace main content area
      const mainContent = document.querySelector("main.main-content");
      if (mainContent) {
        import("./reading-mode/pdfViewer.js").then((module) => {
          module.setupReadingMode(mainContent);
        });
      }
    } else {
      // Restore main content for other modes
      window.location.reload(); // Simple restore, can be improved
    }
  });
});

// Chat functionality
const chatInput = document.querySelector(".chat-input input");
const sendButton = document.querySelector(".send-btn");
const chatMessages = document.querySelector(".chat-messages");

async function sendMessage() {
  const message = chatInput.value.trim();

  if (message) {
    // Create user message
    const userMessage = document.createElement("div");
    userMessage.className = "chat-message user-message";
    userMessage.innerHTML = `<div class="message-bubble user-bubble">${message}</div>`;
    chatMessages.appendChild(userMessage);

    // Clear input
    chatInput.value = "";

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // --- Start of API call ---
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "login.html";
      return;
    }

    // TODO: Implement proper session selection
    let sessionId = localStorage.getItem("sessionId");
    if (!sessionId) {
      try {
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
            window.location.reload(); // Reload to fetch topics for the new session
          } else {
            // Show session creation form
            document.getElementById("session-creation").style.display = "block";
            document
              .getElementById("session-form")
              .addEventListener("submit", async (e) => {
                e.preventDefault();
                const subjectName =
                  document.getElementById("subjectName").value;
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
                      document.getElementById(
                        "session-creation",
                      ).style.display = "none";
                      // Fetch and show topics
                      const sessionDetailsResponse = await fetch(
                        `http://localhost:5000/api/sessions/${newSessionData.data.session.sessionId}`,
                        { headers: { Authorization: `Bearer ${token}` } },
                      );
                      if (sessionDetailsResponse.ok) {
                        const sessionDetails =
                          await sessionDetailsResponse.json();
                        populateSidebar(sessionDetails.data.session.topics);
                        showMainContent();
                      }
                    } else {
                      // Start polling for blueprint generation
                      pollSessionGeneration(
                        newSessionData.data.session.sessionId,
                      );
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
            return;
          }
        }
      } catch (error) {
        console.error("Error fetching sessions:", error);
        return;
      }
    }

    const activeSubtopic = document.querySelector(".subtopic-item.active");
    const subtopicId = activeSubtopic ? activeSubtopic.dataset.id : null;

    try {
      const response = await fetch("http://localhost:5000/api/questions/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          subtopicId,
          question: message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to ask question");
      }

      const data = await response.json();
      const answer = data.userQuestion.answer;

      // Create AI response message
      const aiMessage = document.createElement("div");
      aiMessage.className = "chat-message";
      aiMessage.innerHTML = `<div class="message-bubble">${answer}</div>`;
      chatMessages.appendChild(aiMessage);
    } catch (error) {
      console.error("Error asking question:", error);
      const aiMessage = document.createElement("div");
      aiMessage.className = "chat-message";
      aiMessage.innerHTML = `<div class="message-bubble">Sorry, I encountered an error: ${error.message}</div>`;
      chatMessages.appendChild(aiMessage);
    }
    // --- End of API call ---

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

sendButton.addEventListener("click", sendMessage);

chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});

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

// Show learning content for subtopic
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
  contentContainer.innerHTML = '<div id="generated-content-container"></div>';
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

// Display generated content
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

  const contentHtml = `
    <div class="generated-content-narrative">

      ${
        content.story
          ? `
        <div class="story-section callout info">
            <div class="callout-icon">💡</div>
            <div class="callout-content">
                <div class="callout-title">Story & Motivation</div>
                <div class="callout-text">${formatLearningContent(content.story)}</div>
            </div>
        </div>
      `
          : ""
      }

      ${
        content.theory
          ? `
        <div class="theory-section">
          <h3>Theory & Concepts</h3>
          <div class="content-body">${formatLearningContent(content.theory)}</div>
        </div>
      `
          : ""
      }

      ${
        content.summary
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

    </div>
  `;

  container.innerHTML = contentHtml;
}

function formatLearningContent(text) {
  if (!text) return "";

  let html = text;

  // Process pedagogical elements first
  html = html.replace(
    /> \*\*(Key Concept|Example|Pro Tip)\*\*:([\s\S]*?)(?=\n\n|\n> \*\*|$)/g,
    (match, type, content) => {
      let calloutClass = "info";
      if (type === "Key Concept") calloutClass = "tip";
      if (type === "Example") calloutClass = "warning"; // Using warning style for examples for visual distinction
      return `
            <div class="callout ${calloutClass}">
                <div class="callout-icon">${type === "Key Concept" ? "🔑" : type === "Example" ? "🔬" : "💡"}</div>
                <div class="callout-content">
                    <div class="callout-title">${type}</div>
                    <div class="callout-text"><p>${content.trim().replace(/\n/g, "<br>")}</p></div>
                </div>
            </div>
        `;
    },
  );

  // Process code blocks
  html = html.replace(/```(\w+)?\n([\s\S]+?)\n```/g, (match, lang, code) => {
    const language = lang || "plaintext";
    return `
            <div class="code-block">
                <div class="code-header">
                    <span class="code-language">${language}</span>
                    <div class="code-actions">
                        <button class="code-action-btn">Copy</button>
                    </div>
                </div>
                <div class="code-content"><pre><code>${code.trim()}</code></pre></div>
            </div>
        `;
  });

  // Process headings
  html = html.replace(/^### (.*$)/gim, "<h4>$1</h4>");
  html = html.replace(/^## (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^# (.*$)/gim, "<h2>$1</h2>");

  // Process bold and italics
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Process lists
  html = html.replace(/^\s*[-*] (.*)/gm, "<ul><li>$1</li></ul>");
  html = html.replace(/<\/ul>\n<ul>/g, ""); // Merge consecutive lists

  // Process paragraphs
  html = html
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => {
      if (p.startsWith("<") && p.endsWith(">")) return p; // Don't wrap existing HTML
      return `<p>${p}</p>`;
    })
    .join("");

  // Cleanup extra paragraph tags around block elements
  html = html.replace(
    /<p>(<div class="callout|<div class="code-block|<h2>|<h3>|<h4>|<ul>)/g,
    "$1",
  );
  html = html.replace(/(<\/div>|<\/h2>|<\/h3>|<\/h4>|<\/ul>)<\/p>/g, "$1");

  return html;
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
