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
                const createSessionResponse = await fetch(
                  "http://localhost:5000/api/sessions",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ subjectName, goal }),
                  },
                );
                if (createSessionResponse.ok) {
                  const newSessionData = await createSessionResponse.json();
                  localStorage.setItem("sessionId", newSessionData.session.id);
                  window.location.reload();
                } else {
                  console.error("Failed to create session");
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
          const createSessionResponse = await fetch(
            "http://localhost:5000/api/sessions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ subjectName, goal }),
            },
          );
          if (createSessionResponse.ok) {
            const newSessionData = await createSessionResponse.json();
            localStorage.setItem("sessionId", newSessionData.session.id);
            window.location.reload();
          } else {
            console.error("Failed to create session");
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
    });
  });
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
