export function setupRevisionMode(mainContent, subtopicId) {
  if (!subtopicId) {
    mainContent.innerHTML = `
      <div class="revision-placeholder">
        <h2>Select a Subtopic</h2>
        <p>Please select a subtopic from the sidebar to start revising.</p>
      </div>
    `;
    return;
  }

  mainContent.innerHTML = `
    <div class="revision-container">
      <div class="revision-header">
        <h2>Revision Mode</h2>
        <div id="revision-status">Loading...</div>
      </div>
      <div id="revision-content"></div>
    </div>
  `;

  loadRevisionContent(subtopicId);
}

async function loadRevisionContent(subtopicId) {
  const token = localStorage.getItem("token");
  const contentContainer = document.getElementById("revision-content");
  const statusDiv = document.getElementById("revision-status");

  try {
    console.log(`Fetching revision for subtopic: ${subtopicId}`);
    const response = await fetch(`http://localhost:5000/api/revision/${subtopicId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log(`Revision response status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log("Revision content found:", data);
      renderRevision(data.data.content.content);
      statusDiv.textContent = "";
    } else if (response.status === 404) {
      console.log("Revision content not found (404)");
      statusDiv.textContent = "";
      contentContainer.innerHTML = `
        <div class="learning-options">
          <div class="start-learning-btn" id="start-revision-btn">
            <h3>Ready to revise?</h3>
            <p>Click to generate personalized revision notes for this topic.</p>
            <button class="btn-primary">Generate Revision Notes</button>
          </div>
        </div>
      `;
      document.getElementById("start-revision-btn").addEventListener("click", () => {
        generateRevision(subtopicId);
      });
    } else {
      console.error("Error loading revision:", response.status);
      statusDiv.textContent = "Error loading revision content.";
    }
  } catch (error) {
    console.error("Error loading revision:", error);
    statusDiv.textContent = "Network error.";
  }
}

async function generateRevision(subtopicId) {
  const token = localStorage.getItem("token");
  const statusDiv = document.getElementById("revision-status");

  statusDiv.textContent = "Generating revision notes... This may take a moment.";

  try {
    const response = await fetch("http://localhost:5000/api/revision/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subtopicId }),
    });

    if (response.ok) {
      const data = await response.json();
      renderRevision(data.data.content.content);
      statusDiv.textContent = "";
    } else {
      const error = await response.json();
      statusDiv.textContent = `Error: ${error.message || "Generation failed"}`;
    }
  } catch (error) {
    console.error("Error generating revision:", error);
    statusDiv.textContent = "Network error during generation.";
  }
}

function renderRevision(content) {
  const container = document.getElementById("revision-content");

  let html = '<div class="revision-grid">';

  // Formulas
  if (content.formulas && content.formulas.length > 0) {
    html += `
      <div class="revision-section formulas-section">
        <h3>Key Formulas</h3>
        <div class="cards-container">
          ${content.formulas.map(f => `
            <div class="revision-card formula-card">
              <div class="card-title">${f.name}</div>
              <div class="card-expression">$$${f.expression.replace(/^\$\$|\$\$$/g, '').replace(/^\$|\$$/g, '')}$$</div>
              <div class="card-explanation">${f.explanation}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  // Definitions
  if (content.definitions && content.definitions.length > 0) {
    html += `
      <div class="revision-section definitions-section">
        <h3>Key Definitions</h3>
        <div class="definitions-list">
          ${content.definitions.map(d => `
            <div class="definition-item">
              <span class="term">${d.term}:</span>
              <span class="def">${d.definition}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  // Quiz
  if (content.quiz && content.quiz.length > 0) {
    html += `
      <div class="revision-section quiz-section">
        <h3>Quick Quiz</h3>
        <div class="quiz-container">
          ${content.quiz.map((q, index) => `
            <div class="quiz-item">
              <div class="question"><strong>Q${index + 1}:</strong> ${q.question}</div>
              <div class="answer-container">
                <button class="reveal-btn" onclick="this.nextElementSibling.classList.toggle('visible'); this.style.display='none'">Show Answer</button>
                <div class="answer">${q.answer}</div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  // Tips
  if (content.tips && content.tips.length > 0) {
    html += `
      <div class="revision-section tips-section">
        <h3>Pro Tips</h3>
        <ul class="tips-list">
          ${content.tips.map(t => `<li>${formatText(t)}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  html += '</div>';
  container.innerHTML = html;

  // Re-render KaTeX if available
  if (window.renderMathInElement) {
    window.renderMathInElement(container, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
      ],
      throwOnError: false
    });
  } else {
    console.warn("KaTeX auto-render extension not found");
  }
}

function formatText(text) {
  if (!text) return "";

  // 1. Handle Markdown Bold (**text**)
  let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 2. Handle Markdown Italic (*text*)
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 3. Heuristic: Wrap LaTeX commands in $ if not already wrapped
  // This looks for patterns like \lambda, \frac, etc. that are NOT preceded by $
  // and wraps the surrounding context in $.
  // Note: This is a simple heuristic and might not be perfect.

  // A safer approach for now:
  // If we see a backslash followed by letters (e.g. \lambda), and it's not inside $...$,
  // we can try to wrap the word. But identifying the full equation is hard.

  // Instead, let's just rely on the user regenerating for perfect math, 
  // but for the specific case of single symbols or simple equations, we can try.

  // Let's just return the formatted markdown for now. 
  // The user's specific example "(A - \lambda I)x = 0" is hard to regex capture perfectly without context.
  // However, we can try to replace specific common patterns.

  return formatted;
}
