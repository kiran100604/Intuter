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
          if (sessionsData.sessions.length > 0) {
            sessionId = sessionsData.sessions[0].id;
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
                    localStorage.setItem("sessionId", newSessionData.session.id);

                    // If blueprint is already generated, show topics directly
                    if (newSessionData.session.status === "ready" && newSessionData.session.topicCount > 0) {
                      hideLoadingState();
                      document.getElementById("session-creation").style.display = "none";
                      // Fetch and show topics
                      const sessionDetailsResponse = await fetch(
                        `http://localhost:5000/api/sessions/${newSessionData.session.id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                      );
                      if (sessionDetailsResponse.ok) {
                        const sessionDetails = await sessionDetailsResponse.json();
                        populateSidebar(sessionDetails.session.topics);
                        showMainContent();
                      }
                    } else {
                      // Start polling for blueprint generation
                      pollSessionGeneration(newSessionData.session.id);
                    }
                  } else {
                    hideLoadingState();
                    const errorData = await createSessionResponse.json();
                    showErrorMessage(`Error: ${errorData.message || 'Failed to create session'}`);
                  }
                } catch (error) {
                  hideLoadingState();
                  showErrorMessage(`Error: ${error.message || 'Network error occurred'}`);
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

  const user = JSON.parse(localStorage.getItem("user"));
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
        if (sessionsData.sessions.length > 0) {
          sessionId = sessionsData.sessions[0].id;
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
        populateSidebar(sessionDetailsData.session.topics);
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
              localStorage.setItem("sessionId", newSessionData.session.id);

              // If blueprint is already generated, show topics directly
              if (newSessionData.session.status === "ready" && newSessionData.session.topicCount > 0) {
                hideLoadingState();
                document.getElementById("session-creation").style.display = "none";
                // Fetch and show topics
                const sessionDetailsResponse = await fetch(
                  `http://localhost:5000/api/sessions/${newSessionData.session.id}`,
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                if (sessionDetailsResponse.ok) {
                  const sessionDetails = await sessionDetailsResponse.json();
                  populateSidebar(sessionDetails.session.topics);
                  showMainContent();
                }
              } else {
                // Start polling for blueprint generation
                pollSessionGeneration(newSessionData.session.id);
              }
            } else {
              hideLoadingState();
              const errorData = await createSessionResponse.json();
              showErrorMessage(`Error: ${errorData.message || 'Failed to create session'}`);
            }
          } catch (error) {
            hideLoadingState();
            showErrorMessage(`Error: ${error.message || 'Network error occurred'}`);
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
  const existingLoader = document.querySelector('.loading-overlay');
  if (existingLoader) return;

  const loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'loading-overlay';
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
  const progressFill = document.getElementById('progressFill');
  const loadingMessage = document.querySelector('.loading-message');
  if (progressFill) progressFill.style.width = `${progress}%`;
  if (loadingMessage) loadingMessage.textContent = message;
}

function hideLoadingState() {
  const loadingOverlay = document.querySelector('.loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.remove();
  }
}

function showErrorMessage(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '20px';
  errorDiv.style.right = '20px';
  errorDiv.style.background = '#f44336';
  errorDiv.style.color = 'white';
  errorDiv.style.padding = '12px 20px';
  errorDiv.style.borderRadius = '4px';
  errorDiv.style.zIndex = '9999';
  errorDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';

  document.body.appendChild(errorDiv);

  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

function showMainContent() {
  const mainContent = document.querySelector('main.main-content');
  const sidebar = document.querySelector('.sidebar');

  if (mainContent) mainContent.style.display = 'block';
  if (sidebar) sidebar.style.display = 'block';

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
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();

        if (statusData.progress > 0) {
          updateLoadingProgress(statusData.progress, `Generating topics... (${statusData.topicCount} topics, ${statusData.subtopicCount} subtopics)`);
        }

        if (statusData.status === 'ready' && statusData.blueprintGenerated) {
          hideLoadingState();
          document.getElementById("session-creation").style.display = "none";

          // Fetch and show topics
          const sessionDetailsResponse = await fetch(
            `http://localhost:5000/api/sessions/${sessionId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (sessionDetailsResponse.ok) {
            const sessionDetails = await sessionDetailsResponse.json();
            populateSidebar(sessionDetails.session.topics);
            showMainContent();
          }
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          hideLoadingState();
          showErrorMessage("Topic generation is taking longer than expected. Please try refreshing the page.");
        }
      } else {
        throw new Error('Failed to check session status');
      }
    } catch (error) {
      console.error('Polling error:', error);
      if (attempts < maxAttempts) {
        setTimeout(poll, 2000);
      } else {
        hideLoadingState();
        showErrorMessage("Connection error. Please check your internet and try again.");
      }
    }
  };

  poll();
}

// Show learning content for subtopic
function showSubtopicLearningContent(subtopicItem) {
  const subtopicId = subtopicItem.dataset.id;
  const subtopicName = subtopicItem.querySelector('span:last-child').textContent;
  const mainContent = document.querySelector('main.main-content');

  mainContent.innerHTML = `
    <div class="subtopic-content">
      <h2>${subtopicName}</h2>
      <div class="learning-options">
        <div class="start-learning-btn" id="startLearningBtn">
          <h3>Ready to start learning?</h3>
          <p>Click to generate personalized learning content for this topic.</p>
          <button class="btn-primary">Start Learning</button>
        </div>
      </div>
      <div class="learning-content" id="learningContent" style="display: none;">
        <!-- Generated content will appear here -->
      </div>
    </div>
  `;

  // Add click handler for "Start Learning" button
  document.getElementById('startLearningBtn').addEventListener('click', () => {
    startLearningContentGeneration(subtopicId, subtopicName);
  });
}

// Start learning content generation
async function startLearningContentGeneration(subtopicId, subtopicName) {
  const token = localStorage.getItem('token');
  const sessionId = localStorage.getItem('sessionId');

  if (!token || !sessionId) {
    showErrorMessage('Please log in and select a session first');
    return;
  }

  // Hide the start learning button and show progress
  const startBtn = document.getElementById('startLearningBtn');
  const learningContent = document.getElementById('learningContent');

  if (startBtn) {
    startBtn.style.display = 'none';
  }

  if (learningContent) {
    learningContent.style.display = 'block';
    learningContent.innerHTML = `
      <div class="content-generation-progress">
        <h3>Generating Learning Content</h3>
        <div class="step-indicators">
          <div class="step" id="step-introduction">
            <div class="step-circle">1</div>
            <span>Introduction</span>
          </div>
          <div class="step" id="step-understanding">
            <div class="step-circle">2</div>
            <span>Understanding</span>
          </div>
          <div class="step" id="step-mastering">
            <div class="step-circle">3</div>
            <span>Mastering</span>
          </div>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-content" id="contentProgress"></div>
        </div>
        <p class="progress-text" id="progressText">Initializing...</p>
      </div>
    `;
  }

  try {
    // Start content generation
    const response = await fetch('http://localhost:5000/api/learning/content/generate-learning', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        subtopicId,
        sessionId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to start content generation');
    }

    // Start polling for progress
    pollContentGenerationProgress(subtopicId, subtopicName);

  } catch (error) {
    console.error('Error starting content generation:', error);
    showErrorMessage(`Error: ${error.message}`);

    // Restore the start button on error
    if (startBtn) {
      startBtn.style.display = 'block';
    }
    if (learningContent) {
      learningContent.style.display = 'none';
    }
  }
}

// Poll content generation progress
async function pollContentGenerationProgress(subtopicId, subtopicName) {
  const token = localStorage.getItem('token');
  let attempts = 0;
  const maxAttempts = 120; // 4 minutes with 2-second intervals

  const updateStepProgress = (currentStep, progress) => {
    const steps = ['introduction', 'understanding', 'mastering'];
    const stepIndex = steps.indexOf(currentStep.replace('generating_', ''));

    steps.forEach((step, index) => {
      const stepElement = document.getElementById(`step-${step}`);
      if (stepElement) {
        const circle = stepElement.querySelector('.step-circle');

        if (index < stepIndex) {
          stepElement.classList.add('completed');
          circle.textContent = '✓';
        } else if (index === stepIndex) {
          stepElement.classList.add('active');
        }
      }
    });

    const progressBar = document.getElementById('contentProgress');
    const progressText = document.getElementById('progressText');

    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressText) {
      const stepText = stepIndex === 0 ? 'Introduction' :
                      stepIndex === 1 ? 'Understanding' : 'Mastering';
      progressText.textContent = `Generating ${stepText}...`;
    }
  };

  const poll = async () => {
    try {
      attempts++;

      const response = await fetch(
        `http://localhost:5000/api/learning/progress/${subtopicId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();

        updateStepProgress(data.currentStep, data.progress);

        if (data.status === 'completed' && data.content) {
          // Show completed content
          displayGeneratedContent(data.content, subtopicName);
          return;
        }

        if (data.status === 'error') {
          throw new Error(data.error || 'Content generation failed');
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          throw new Error('Content generation timed out');
        }
      } else {
        throw new Error('Failed to check progress');
      }
    } catch (error) {
      console.error('Polling error:', error);
      showErrorMessage(`Error: ${error.message}`);

      // Restore start button
      const startBtn = document.getElementById('startLearningBtn');
      const learningContent = document.getElementById('learningContent');

      if (startBtn) startBtn.style.display = 'block';
      if (learningContent) learningContent.style.display = 'none';
    }
  };

  poll();
}

// Display generated content
function displayGeneratedContent(content, subtopicName) {
  const learningContent = document.getElementById('learningContent');
  if (!learningContent) return;

  learningContent.innerHTML = `
    <div class="generated-content">
      <div class="content-tabs">
        <button class="tab-btn active" data-step="introduction">1. Introduction</button>
        <button class="tab-btn" data-step="understanding">2. Understanding</button>
        <button class="tab-btn" data-step="mastering">3. Mastering</button>
      </div>

      <div class="content-sections">
        <div class="content-section active" id="section-introduction">
          ${content.introduction ? `<div class="content-body">${formatLearningContent(content.introduction)}</div>` : '<p>Content still generating...</p>'}
        </div>
        <div class="content-section" id="section-understanding">
          ${content.understanding ? `<div class="content-body">${formatLearningContent(content.understanding)}</div>` : '<p>Content still generating...</p>'}
        </div>
        <div class="content-section" id="section-mastering">
          ${content.mastering ? `<div class="content-body">${formatLearningContent(content.mastering)}</div>` : '<p>Content still generating...</p>'}
        </div>
      </div>
    </div>
  `;

  // Add tab switching functionality
  const tabBtns = learningContent.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const step = btn.dataset.step;

      // Update tab buttons
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update content sections
      const sections = learningContent.querySelectorAll('.content-section');
      sections.forEach(section => section.classList.remove('active'));
      document.getElementById(`section-${step}`).classList.add('active');
    });
  });
}

// Format learning content (basic formatting)
function formatLearningContent(content) {
  return content
    .replace(/\n\n/g, '</p><p>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
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
