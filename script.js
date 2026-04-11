 const OPENROUTER_API_KEY = "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";

const config = {
  apiKey: localStorage.getItem("openrouter_api_key") || null,
  maxRetries: 3,
  retryDelay: 1000,
};

const state = {
  isGenerating: false,
  currentTemplate: "general",
  currentThreadId: null,
  currentStepIndex: -1,
  metrics: {
    totalRequests: 0,
    successfulRequests: 0,
    averageResponseTime: 0,
    agentPerformance: {},
  },
};

// DOM elements
const btn = document.querySelector("#generateBtn");
const inputTopic = document.querySelector("#topicInput");
const statusBar = document.querySelector("#status");
const textOutput = document.querySelector("#textOutput");
const writerOutput = document.querySelector("#writerOutput");
const researchOutput = document.querySelector("#researchOutput");
const templateSelect = document.querySelector("#templateSelect");
const historySearch = document.querySelector("#historySearch");
const navControls = document.querySelector("#navControls");
const prevBtn = document.querySelector("#prevBtn");
const nextBtn = document.querySelector("#nextBtn");
const navCounter = document.querySelector("#navCounter");

// Enhanced agent prompts with templates (no change)
const agentPrompts = {
  general: {
    summary: (topic) =>
      `Create a concise, informative 2-sentence summary of "${topic}". Focus on the most important aspects and current relevance.`,
    writer: (topic) =>
      `Act as a professional content writer. Create an engaging 200-word article about "${topic}". The article must be well-structured. Include a compelling hook, 2-3 key points in separate paragraphs, and a strong conclusion. Use active voice and storytelling elements. Separate all paragraphs with a double line break.`,
    research: (topic) =>
      `Act as a research analyst. Provide exactly 3 current, data-backed insights about "${topic}". Include specific statistics, recent trends, and credible context. Format as numbered points with actionable information.`,
  },
  "blog-post": {
    summary: (topic) =>
      `Create an SEO-friendly meta description (2 sentences) for a blog post about "${topic}".`,
    writer: (topic) =>
      `Write a comprehensive 300-word blog post about "${topic}". The post must be well-structured with a compelling headline, an introduction with a hook, 3 main sections with clear subheadings (e.g., "### My Subheading"), and a call-to-action conclusion. Ensure paragraphs are well-separated by double line breaks.`,
    research: (topic) =>
      `Provide 3 key statistics and recent research findings about "${topic}" that would strengthen a blog post. Include sources and publication dates where possible.`,
  },
  "social-media": {
    summary: (topic) =>
      `Create a punchy 1-sentence social media hook about "${topic}" that would make people stop scrolling.`,
    writer: (topic) =>
      `Create 3 social media posts about "${topic}". Use the following format with clear labels:\n\n**LinkedIn Post:**\n(A 150-word professional post)\n\n**Twitter Thread Starter:**\n(A 280-character engaging hook)\n\n**Instagram Caption:**\n(A 100-word caption with relevant hashtags at the end)`,
    research: (topic) =>
      `Find 3 trending hashtags, recent news, or viral content related to "${topic}" that could boost social media engagement.`,
  },
  newsletter: {
    summary: (topic) =>
      `Write a compelling newsletter subject line and preview text about "${topic}" that maximizes open rates.`,
    writer: (topic) =>
      `Create a newsletter section about "${topic}". Structure it precisely as follows, using clear labels and line breaks:\n\n**Subject:**\n(An attention-grabbing subject line)\n\n**Body:**\n(A personal introduction, followed by the main content of about 200 words, broken into short, easy-to-read paragraphs)\n\n**Call to Action:**\n(A clear call-to-action with a sense of urgency)`,
    research: (topic) =>
      `Provide 3 timely insights or trends about "${topic}" that newsletter subscribers would find valuable and actionable.`,
  },
  technical: {
    summary: (topic) =>
      `Create a technical overview (2 sentences) of "${topic}" suitable for documentation or API reference.`,
    writer: (topic) =>
      `Write technical documentation for developers about "${topic}". Structure the document with the following sections, using clear headings for each:\n\n- **Overview:**\n- **Key Concepts:** (Use a bulleted list with '-' for each item)\n- **Implementation Steps:** (Use a numbered list)\n- **Best Practices:** (Use a bulleted list with '-' for each item)\n\nUse clear, precise language.`,
    research: (topic) =>
      `Provide 3 technical considerations, performance metrics, or industry standards related to "${topic}" with specific examples.`,
  },
};

// Function to create smart history titles (no change)
function createSmartHistoryTitle(topic) {
  if (topic.length <= 40) return topic;
  const words = topic.split(" ");
  if (topic.includes("?")) {
    const questionWords = words.slice(0, 8).join(" ");
    return questionWords.length < topic.length
      ? questionWords + "..."
      : questionWords;
  }
  const commonStarters = [
    "how to",
    "what is",
    "why does",
    "when should",
    "where can",
    "who is",
  ];
  const lowerTopic = topic.toLowerCase();
  for (let starter of commonStarters) {
    if (lowerTopic.startsWith(starter)) {
      const relevantPart = words.slice(0, 6).join(" ");
      return relevantPart.length < topic.length
        ? relevantPart + "..."
        : relevantPart;
    }
  }
  let smartTitle = "";
  let wordCount = 0;
  for (let word of words) {
    if (smartTitle.length + word.length > 35) break;
    smartTitle += (wordCount > 0 ? " " : "") + word;
    wordCount++;
    if (wordCount >= 5) break;
  }
  return smartTitle.length < topic.length ? smartTitle + "..." : smartTitle;
}

// Initialize API key with validation (no change)
function initializeApiKey() {
  if (config.apiKey) {
    const key =
      "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";
    if (key && key.trim()) {
      config.apiKey = key.trim();
      localStorage.setItem("openrouter_api_key", key.trim());
    } else {
      alert("API key is required to use AutoCreator.");
      return false;
    }
  }
  if (!config.apiKey.startsWith("sk-or-v1-")) {
    console.warn(
      "⚠️ API key format may be incorrect. OpenRouter keys should start with 'sk-or-v1-'"
    );
    const confirm = window.confirm(
      "Your API key doesn't look like a valid OpenRouter key.\n\nDo you want to continue anyway?"
    );
    if (!confirm) {
      localStorage.removeItem("openrouter_api_key");
      config.apiKey = null;
      return false;
    }
  }
  return true;
}

// API call with retry logic (no change)
async function generateAIResponseWithRetry(prompt, agentName) {
  const startTime = Date.now();
  if (!config.apiKey || config.apiKey.length < 10)
    return "⚠️ Invalid API key. Please check your OpenRouter API key.";
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      state.metrics.totalRequests++;
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin,
            "X-Title": "AutoCreator Multi-Agent Studio",
          },
          body: JSON.stringify({
            model: "openai/gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
          }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `HTTP ${response.status}: ${
            errorData.error?.message || response.statusText
          }`
        );
      }
      const data = await response.json();
      if (!data.choices || !data.choices[0] || !data.choices[0].message)
        throw new Error("Invalid response format from API");
      let responseText = data.choices[0].message.content.trim();
      const responseTime = Date.now() - startTime;
      state.metrics.successfulRequests++;
      state.metrics.averageResponseTime =
        (state.metrics.averageResponseTime *
          (state.metrics.successfulRequests - 1) +
          responseTime) /
        state.metrics.successfulRequests;
      if (!state.metrics.agentPerformance[agentName]) {
        state.metrics.agentPerformance[agentName] = {
          requests: 0,
          totalTime: 0,
          successRate: 0,
        };
      }
      const agentMetrics = state.metrics.agentPerformance[agentName];
      agentMetrics.requests++;
      agentMetrics.totalTime += responseTime;
      agentMetrics.successRate =
        (state.metrics.successfulRequests / state.metrics.totalRequests) * 100;
      return responseText;
    } catch (error) {
      if (attempt === config.maxRetries)
        return `⚠️ Failed after ${config.maxRetries} attempts: ${error.message}.`;
      statusBar.textContent = `🔄 Retry ${attempt}/${config.maxRetries}... (${error.message})`;
      await new Promise((resolve) =>
        setTimeout(resolve, config.retryDelay * attempt)
      );
    }
  }
}

function displayText(element, text) {
  element.textContent = text.trim();
  element.classList.remove("typing");
}

function revealElement(element) {
  element.classList.add("visible");
}

// Main generation function
btn.addEventListener("click", async () => {
  if (!initializeApiKey()) return;
  const topic = inputTopic.value.trim();
  if (!topic) return;
  if (state.isGenerating) {
    statusBar.textContent = "⏳ Please wait, agents are still working...";
    return;
  }

  state.isGenerating = true;
  btn.disabled = true;
  btn.textContent = "⏳";
  navControls.classList.add("hidden");

  const history = JSON.parse(localStorage.getItem("history")) || [];
  const currentThread = history.find((h) => h.id === state.currentThreadId);
  const lastStep = currentThread
    ? currentThread.steps[state.currentStepIndex]
    : null;
  const isFollowUp = isRelated(topic, lastStep ? lastStep.topic : null);
  const template = templateSelect.value;

  let threadId =
    isFollowUp && currentThread ? currentThread.id : `thread-${Date.now()}`;

  [textOutput, writerOutput, researchOutput].forEach((el) => {
    el.textContent = "";
    el.classList.remove("visible");
  });

  const prompts = agentPrompts[template];
  try {
    statusBar.textContent = "📄 Summary Agent analyzing...";
    const summary = await generateAIResponseWithRetry(
      prompts.summary(topic),
      "summary"
    );
    displayText(textOutput, `📝 Summary:\n${summary}`);
    revealElement(textOutput);

    statusBar.textContent = "✍️ Writer Agent crafting content...";
    const writer = await generateAIResponseWithRetry(
      `${prompts.writer(topic)}\n\nContext: ${summary}`,
      "writer"
    );
    displayText(writerOutput, `✍️ Writer Agent:\n${writer}`);
    revealElement(writerOutput);

    statusBar.textContent = "📊 Research Agent gathering insights...";
    const research = await generateAIResponseWithRetry(
      `${prompts.research(topic)}\n\nContext: ${summary}`,
      "research"
    );
    displayText(researchOutput, `📊 Research Agent:\n${research}`);
    revealElement(researchOutput);

    const outputs = { summary, writer, research };
    saveStepToHistory(threadId, topic, template, outputs);

    const newHistory = JSON.parse(localStorage.getItem("history")) || [];
    const newThread = newHistory.find((h) => h.id === threadId);
    state.currentThreadId = threadId;
    state.currentStepIndex = newThread.steps.length - 1;

    statusBar.textContent = "✅ All agents completed successfully!";
  } catch (err) {
    statusBar.textContent = `❌ Something went wrong: ${err.message}`;
  } finally {
    state.isGenerating = false;
    btn.disabled = false;
    btn.textContent = "➤";
    updateNavControls();
    // This is the primary fix for the "saving" issue.
    // Ensure the UI is updated with the new item.
    updateHistoryUI();
    addToggleToAgents();
  }
});

function isRelated(newTopic, oldTopic) {
  if (!oldTopic) return false;
  const stopWords = new Set([
    "a",
    "an",
    "the",
    "is",
    "are",
    "was",
    "were",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "and",
    "or",
    "but",
    "how",
    "what",
    "who",
    "when",
    "why",
    "create",
    "write",
    "about",
  ]);
  const getWords = (text) =>
    new Set(
      text
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => !stopWords.has(word) && word.length > 2)
    );
  const words1 = getWords(newTopic);
  const words2 = getWords(oldTopic);
  if (words1.size === 0 || words2.size === 0) return false;
  const intersection = new Set([...words1].filter((word) => words2.has(word)));
  const overlap = intersection.size / Math.min(words1.size, words2.size);
  return overlap > 0.3;
}

function saveStepToHistory(threadId, topic, template, outputs) {
  let history = JSON.parse(localStorage.getItem("history")) || [];
  let thread = history.find((h) => h.id === threadId);
  const newStep = { topic, outputs, time: new Date().toISOString() };

  if (thread) {
    thread.steps.push(newStep);
  } else {
    const newThread = {
      id: threadId,
      title: createSmartHistoryTitle(topic),
      template,
      createdAt: new Date().toISOString(),
      steps: [newStep],
    };
    history.unshift(newThread);
  }
  history = history.slice(0, 50);
  localStorage.setItem("history", JSON.stringify(history));
}

function displayStep(threadId, stepIndex) {
  const history = JSON.parse(localStorage.getItem("history")) || [];
  const thread = history.find((h) => h.id === threadId);
  if (!thread || !thread.steps[stepIndex]) return;

  const step = thread.steps[stepIndex];
  state.currentThreadId = threadId;
  state.currentStepIndex = stepIndex;

  inputTopic.value = step.topic;
  templateSelect.value = thread.template;

  [textOutput, writerOutput, researchOutput].forEach((el) =>
    el.classList.remove("visible")
  );

  setTimeout(() => {
    displayText(textOutput, `📝 Summary:\n${step.outputs.summary}`);
    revealElement(textOutput);
    displayText(writerOutput, `✍️ Writer Agent:\n${step.outputs.writer}`);
    revealElement(writerOutput);
    displayText(researchOutput, `📊 Research Agent:\n${step.outputs.research}`);
    revealElement(researchOutput);
    addToggleToAgents();
  }, 50);

  statusBar.textContent = `Displaying step ${stepIndex + 1} of ${
    thread.steps.length
  } from a past conversation.`;
  updateNavControls();
  // Call updateHistoryUI to make sure the "active" class is set on the correct item.
  updateHistoryUI();
}

function loadThread(threadId, stepIndex = -1) {
  const history = JSON.parse(localStorage.getItem("history")) || [];
  const thread = history.find((h) => h.id === threadId);
  if (!thread) return;
  const indexToLoad = stepIndex === -1 ? thread.steps.length - 1 : stepIndex;
  displayStep(threadId, indexToLoad);
}

function updateHistoryUI(filteredHistory = null) {
  const historyList = document.getElementById("historyList");
  const template = document.getElementById("historyItemTemplate");
  if (!historyList || !template) return;

  historyList.innerHTML = "";
  const history =
    filteredHistory || JSON.parse(localStorage.getItem("history")) || [];

  history.forEach((thread) => {
    const clone = template.content.cloneNode(true);
    const li = clone.querySelector(".history-item");
    const timestamp = li.querySelector(".timestamp");
    const topicText = li.querySelector(".topic-text");
    const removeBtn = li.querySelector(".remove-btn");

    const stepCount =
      thread.steps.length > 1 ? ` (${thread.steps.length} steps)` : "";
    timestamp.textContent = `${new Date(
      thread.createdAt
    ).toLocaleDateString()} • ${thread.template}`;
    topicText.textContent = thread.title + stepCount;
    topicText.title = thread.steps[0].topic;

    if (thread.id === state.currentThreadId) {
      li.classList.add("active-history");
    }

    // Set up the click event for the history item itself.
    li.addEventListener("click", () => loadThread(thread.id));

    // Set up the click event for the delete button.
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // Stop the event from bubbling up to the `li`
      if (
        confirm(
          `Are you sure you want to delete the thread: "${thread.title}"?`
        )
      ) {
        // This is the fix for the "deletion" issue.
        // We now call a dedicated function to handle the deletion and UI refresh.
        clearHistory(thread.id);
      }
    });

    historyList.appendChild(clone);
  });
}

// Fixed clearHistory function to ensure the UI is refreshed.
function clearHistory(threadIdToRemove) {
  let history = JSON.parse(localStorage.getItem("history")) || [];
  history = history.filter((item) => item.id !== threadIdToRemove);
  localStorage.setItem("history", JSON.stringify(history));

  // If the deleted thread was the active one, clear the main view.
  if (state.currentThreadId === threadIdToRemove) {
    state.currentThreadId = null;
    state.currentStepIndex = -1;
    clearMainView();
  }
  // This is the critical line that was missing or being called incorrectly.
  // It ensures the UI is updated immediately after deletion.
  updateHistoryUI();
}

function clearAllHistory() {
  if (confirm("Are you sure you want to clear all history?")) {
    localStorage.removeItem("history");
    state.currentThreadId = null;
    state.currentStepIndex = -1;
    clearMainView();
    // This is correct, but it's good to keep it explicit for clarity.
    updateHistoryUI();
  }
}

function clearMainView() {
  inputTopic.value = "";
  [textOutput, writerOutput, researchOutput].forEach((el) => {
    el.textContent = "";
    el.classList.remove("visible");
  });
  statusBar.textContent = "Awaiting your topic...";
  navControls.classList.add("hidden");
  // This is a subtle change. We no longer call updateHistoryUI here, as clearAllHistory already does.
}

function updateNavControls() {
  const history = JSON.parse(localStorage.getItem("history")) || [];
  const thread = history.find((h) => h.id === state.currentThreadId);

  if (!thread || thread.steps.length <= 1) {
    navControls.classList.add("hidden");
    return;
  }
  navControls.classList.remove("hidden");
  prevBtn.disabled = state.currentStepIndex === 0;
  nextBtn.disabled = state.currentStepIndex === thread.steps.length - 1;
  navCounter.textContent = `${state.currentStepIndex + 1} / ${
    thread.steps.length
  }`;
}

function searchHistory(query) {
  const history = JSON.parse(localStorage.getItem("history")) || [];
  if (!query) return history;
  query = query.toLowerCase();
  return history.filter(
    (thread) =>
      thread.title.toLowerCase().includes(query) ||
      thread.steps.some((step) => step.topic.toLowerCase().includes(query))
  );
}

function exportContent() {
  if (!state.currentThreadId) {
    alert("Please select a conversation from the history to export.");
    return;
  }
  const history = JSON.parse(localStorage.getItem("history")) || [];
  const thread = history.find((h) => h.id === state.currentThreadId);
  if (!thread) {
    alert("Could not find the selected conversation to export.");
    return;
  }
  const content = { ...thread, metrics: state.metrics };
  const blob = new Blob([JSON.stringify(content, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `autocreator-thread-${thread.title
    .replace(/\s+/g, "-")
    .toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function toggleTheme() {
  document.body.classList.toggle("light-theme");
  const theme = document.body.classList.contains("light-theme")
    ? "light"
    : "dark";
  localStorage.setItem("theme", theme);
  document.querySelector(".theme-toggle").textContent =
    theme === "light" ? "☀️" : "🌙";
}

function toggleMetrics() {
  const metricsEl = document.getElementById("performanceMetrics");
  if (metricsEl.classList.contains("visible")) {
    metricsEl.classList.remove("visible");
  } else {
    updateMetricsDisplay();
    metricsEl.classList.add("visible");
  }
}

function updateMetricsDisplay() {
  const metricsContent = document.getElementById("metricsContent");
  const m = state.metrics;
  metricsContent.innerHTML = `<p><strong>Total Requests:</strong> ${
    m.totalRequests
  }</p>
       <p><strong>Success Rate:</strong> ${
         m.totalRequests > 0
           ? ((m.successfulRequests / m.totalRequests) * 100).toFixed(1)
           : 0
       }%</p>
       <p><strong>Avg Response Time:</strong> ${m.averageResponseTime.toFixed(
         0
       )}ms</p>`;
}

function addToggleToAgents() {
  const agentMessages = document.querySelectorAll(".agent-message.bot");
  agentMessages.forEach((msg) => {
    if (!msg.querySelector(".toggle-arrow")) {
      const toggle = document.createElement("div");
      toggle.className = "toggle-arrow";
      toggle.textContent = "⯆";
      toggle.addEventListener("click", () => {
        msg.classList.toggle("collapsed");
        toggle.textContent = msg.classList.contains("collapsed") ? "⯈" : "⯆";
      });
      msg.appendChild(toggle);
    }
  });
}

// Event listeners
historySearch.addEventListener("input", (e) =>
  updateHistoryUI(searchHistory(e.target.value))
);
templateSelect.addEventListener(
  "change",
  (e) => (state.currentTemplate = e.target.value)
);
prevBtn.addEventListener("click", () => {
  if (state.currentStepIndex > 0)
    loadThread(state.currentThreadId, state.currentStepIndex - 1);
});
nextBtn.addEventListener("click", () => {
  const history = JSON.parse(localStorage.getItem("history")) || [];
  const thread = history.find((h) => h.id === state.currentThreadId);
  if (thread && state.currentStepIndex < thread.steps.length - 1)
    loadThread(state.currentThreadId, state.currentStepIndex + 1);
});

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") {
    e.preventDefault();
    btn.click();
  }
  if (e.ctrlKey && e.key === "s") {
    e.preventDefault();
    exportContent();
  }
  if (e.ctrlKey && e.key === "d") {
    e.preventDefault();
    toggleTheme();
  }
});

window.addEventListener("DOMContentLoaded", () => {
  updateHistoryUI();
  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-theme");
    document.querySelector(".theme-toggle").textContent = "☀️";
  }
  const savedMetrics = localStorage.getItem("autocreator_metrics");
  if (savedMetrics)
    state.metrics = { ...state.metrics, ...JSON.parse(savedMetrics) };
});

setInterval(
  () =>
    localStorage.setItem("autocreator_metrics", JSON.stringify(state.metrics)),
  30000
);
