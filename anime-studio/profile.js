document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const sessionsList = document.getElementById("sessions-list");
  const sessionForm = document.getElementById("session-form");

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
        sessionsList.innerHTML = "<p>No sessions found. Create one below!</p>";
      } else {
        sessions.forEach((session) => {
          const sessionElement = document.createElement("div");
          sessionElement.className = "session-item"; // Add a class for styling
          sessionElement.innerHTML = `
                        <h3>${session.subjectName}</h3>
                        <p>${session.goal}</p>
                    `;
          sessionElement.addEventListener("click", () => {
            localStorage.setItem("sessionId", session.id);
            window.location.href = "index.html";
          });
          sessionsList.appendChild(sessionElement);
        });
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
      sessionsList.innerHTML =
        "<p>Error loading sessions. Please try again.</p>";
    }
  }

  sessionForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const subjectName = sessionForm.subjectName.value;
    const goal = sessionForm.goal.value;

    try {
      const response = await fetch("http://localhost:5000/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subjectName, goal }),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      fetchAndDisplaySessions(); // Refresh the list
      sessionForm.reset(); // Clear the form
    } catch (error) {
      console.error("Error creating session:", error);
    }
  });

  fetchAndDisplaySessions();
});
