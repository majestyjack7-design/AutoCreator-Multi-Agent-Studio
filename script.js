/*
  AutoCreator Multi-Agent Studio - Rebuilt JS
  -------------------------------------------------
  For quick testing only:
  Paste your OpenRouter API key below.
  Do not use this method for a live/public website.
*/

const DEV_OPENROUTER_API_KEY = "PASTE_YOUR_OPENROUTER_API_KEY_HERE";

const config = {
  apiKeyStorageKey: "openrouter_api_key",
  historyStorageKey: "history",
  metricsStorageKey: "autocreator_metrics",
  themeStorageKey: "theme",
  maxRetries: 3,
  retryDelay: 1000,
  model: "openai/gpt-4o-mini",
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

const elements = {};

function cacheElements() {
  elements.btn = document.querySelector("#generateBtn");
  elements.inputTopic = document.querySelector("#topicInput");
  elements.statusBar = document.querySelector("#status");
  elements.textOutput = document.querySelector("#textOutput");
  elements.writerOutput = document.querySelector("#writerOutput");
  elements.researchOutput = document.querySelector("#researchOutput");
  elements.templateSelect = document.querySelector("#templateSelect");
  elements.historySearch = document.querySelector("#historySearch");
  elements.navControls = document.querySelector("#navControls");
  elements.prevBtn = document.querySelector("#prevBtn");
  elements.nextBtn = document.querySelector("#nextBtn");
  elements.navCounter = document.querySelector("#navCounter");
  elements.historyList = document.querySelector("#historyList");
  elements.historyItemTemplate = document.querySelector("#historyItemTemplate");
  elements.metricsPanel = document.querySelector("#performanceMetrics");
  elements.metricsContent = document.querySelector("#metricsContent");
  elements.themeToggle = document.querySelector(".theme-toggle");
}

const agentPrompts = {
  general: {
    summary: (topic) =>
      `Create a concise, informative 2-sentence summary of "${topic}". Focus on the most important aspects and current relevance.`,
    writer: (topic) =>
      `Act as a professional content writer. Create an engaging 200-word article about "${topic}". Include a compelling hook, 2-3 key points in separate paragraphs, and a strong conclusion. Use active voice. Separate paragraphs with a double line break.`,
    research: (topic) =>
      `Act as a research analyst. Provide exactly 3 current, data-backed insights about "${topic}". Format as numbered points.`,
  },
  "blog-post": {
    summary: (topic) =>
      `Create an SEO-friendly meta description, 2 sentences, for a blog post about "${topic}".`,
    writer: (topic) =>
      `Write a 300-word blog post about "${topic}". Include a headline, introduction, 3 clear subheadings, and a call-to-action conclusion.`,
    research: (topic) =>
      `Provide 3 key statistics or research findings about "${topic}" that would strengthen a blog post.`,
  },
  "social-media": {
    summary: (topic) =>
      `Create a punchy 1-sentence social media hook about "${topic}".`,
    writer: (topic) =>
      `Create 3 social media posts about "${topic}". Include LinkedIn, Twitter/X, and Instagram versions with clear labels.`,
    research: (topic) =>
      `Provide 3 trending hashtags, recent angles, or viral content ideas related to "${topic}".`,
  },
  newsletter: {
    summary: (topic) =>
      `Write a compelling newsletter subject line and preview text about "${topic}".`,
    writer: (topic) =>
      `Create a newsletter section about "${topic}" with Subject, Body, and Call to Action sections.`,
    research: (topic) =>
      `Provide 3 timely insights or trends about "${topic}" that newsletter subscribers would find useful.`,
  },
  technical: {
    summary: (topic) =>
      `Create a technical overview, 2 sentences, of "${topic}" suitable for documentation.`,
    writer: (topic) =>
      `Write technical documentation for developers about "${topic}". Include Overview, Key Concepts, Implementation Steps, and Best Practices.`,
    research: (topic) =>
      `Provide 3 technical considerations, performance metrics, or industry standards related to "${topic}".`,
  },
};

function getFromStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getHistory() {
  return getFromStorage(config.historyStorageKey, []);
}

function saveHistory(history) {
  saveToStorage(config.historyStorageKey, history.slice(0, 50));
}

function setStatus(message) {
  if (elements.statusBar) elements.statusBar.textContent = message;
}

function displayText(element, text) {
  if (!element) return;
  element.textContent = text.trim();
  element.classList.remove("typing");
  element.classList.add("visible");
}

function clearOutputs() {
  [elements.textOutput, elements.writerOutput, elements.researchOutput].forEach(
    (el) => {
      if (!el) return;
      el.textContent = "";
      el.classList.remove("visible", "typing");
    }
  );
}

function clearMainView() {
  if (elements.inputTopic) elements.inputTopic.value = "";
  clearOutputs();
  setStatus("Awaiting your topic...");
  elements.navControls?.classList.add("hidden");
}

function getApiKey() {
  const devKey = DEV_OPENROUTER_API_KEY.trim();

  if (devKey && devKey !== "PASTE_YOUR_OPENROUTER_API_KEY_HERE") {
    return devKey;
  }

  const savedKey = localStorage.getItem(config.apiKeyStorageKey);

  if (savedKey && savedKey.trim().startsWith("sk-or-v1-")) {
    return savedKey.trim();
  }

  const enteredKey = prompt("Please enter your OpenRouter API key:");

  if (!enteredKey || !enteredKey.trim()) {
    alert("API key is required to use AutoCreator.");
    return null;
  }

  const cleanKey = enteredKey.trim();

  if (!cleanKey.startsWith("sk-or-v1-")) {
    alert("That does not look like a valid OpenRouter API key.");
    return null;
  }

  localStorage.setItem(config.apiKeyStorageKey, cleanKey);
  return cleanKey;
}

function createSmartHistoryTitle(topic) {
  const cleanTopic = topic.trim();
  if (cleanTopic.length <= 40) return cleanTopic;

  const words = cleanTopic.split(/\s+/).slice(0, 7).join(" ");
  return words.length < cleanTopic.length ? `${words}...` : words;
}

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
        .map((word) => word.replace(/[^a-z0-9]/gi, ""))
        .filter((word) => word.length > 2 && !stopWords.has(word))
    );

  const words1 = getWords(newTopic);
  const words2 = getWords(oldTopic);

  if (!words1.size || !words2.size) return false;

  const matches = [...words1].filter((word) => words2.has(word));
  return matches.length / Math.min(words1.size, words2.size) > 0.3;
}

async function callOpenRouter(promptText, agentName, apiKey) {
  const startTime = Date.now();

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      state.metrics.totalRequests += 1;

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "AutoCreator Multi-Agent Studio",
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: "user", content: promptText }],
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = data?.error?.message || response.statusText;
        throw new Error(`HTTP ${response.status}: ${message}`);
      }

      const output = data?.choices?.[0]?.message?.content;

      if (!output) {
        throw new Error("Invalid response format from OpenRouter.");
      }

      updateMetrics(agentName, Date.now() - startTime, true);
      return output.trim();
    } catch (error) {
      if (attempt === config.maxRetries) {
        updateMetrics(agentName, Date.now() - startTime, false);
        throw error;
      }

      setStatus(`Retrying ${agentName} agent... Attempt ${attempt + 1}/${config.maxRetries}`);
      await new Promise((resolve) =>
        setTimeout(resolve, config.retryDelay * attempt)
      );
    }
  }
}

function updateMetrics(agentName, responseTime, wasSuccessful) {
  if (wasSuccessful) {
    state.metrics.successfulRequests += 1;
    state.metrics.averageResponseTime =
      (state.metrics.averageResponseTime *
        (state.metrics.successfulRequests - 1) +
        responseTime) /
      state.metrics.successfulRequests;
  }

  if (!state.metrics.agentPerformance[agentName]) {
    state.metrics.agentPerformance[agentName] = {
      requests: 0,
      totalTime: 0,
      successRate: 0,
    };
  }

  const agent = state.metrics.agentPerformance[agentName];
  agent.requests += 1;
  agent.totalTime += responseTime;
  agent.successRate = state.metrics.totalRequests
    ? (state.metrics.successfulRequests / state.metrics.totalRequests) * 100
    : 0;
}

function saveStepToHistory(threadId, topic, template, outputs) {
  const history = getHistory();
  let thread = history.find((item) => item.id === threadId);

  const step = {
    topic,
    template,
    outputs,
    time: new Date().toISOString(),
  };

  if (thread) {
    thread.steps.push(step);
  } else {
    thread = {
      id: threadId,
      title: createSmartHistoryTitle(topic),
      template,
      createdAt: new Date().toISOString(),
      steps: [step],
    };
    history.unshift(thread);
  }

  saveHistory(history);
}

function displayStep(threadId, stepIndex) {
  const history = getHistory();
  const thread = history.find((item) => item.id === threadId);

  if (!thread || !thread.steps[stepIndex]) return;

  const step = thread.steps[stepIndex];

  state.currentThreadId = threadId;
  state.currentStepIndex = stepIndex;

  if (elements.inputTopic) elements.inputTopic.value = step.topic;
  if (elements.templateSelect) elements.templateSelect.value = thread.template;

  clearOutputs();

  displayText(elements.textOutput, `📝 Summary:\n${step.outputs.summary}`);
  displayText(elements.writerOutput, `✍️ Writer Agent:\n${step.outputs.writer}`);
  displayText(elements.researchOutput, `📊 Research Agent:\n${step.outputs.research}`);

  setStatus(`Displaying step ${stepIndex + 1} of ${thread.steps.length}.`);
  updateNavControls();
  updateHistoryUI();
  addToggleToAgents();
}

function loadThread(threadId, stepIndex = -1) {
  const history = getHistory();
  const thread = history.find((item) => item.id === threadId);
  if (!thread) return;

  const indexToLoad = stepIndex === -1 ? thread.steps.length - 1 : stepIndex;
  displayStep(threadId, indexToLoad);
}

function deleteThread(threadId) {
  const history = getHistory().filter((item) => item.id !== threadId);
  saveHistory(history);

  if (state.currentThreadId === threadId) {
    state.currentThreadId = null;
    state.currentStepIndex = -1;
    clearMainView();
  }

  updateHistoryUI();
}

function clearAllHistory() {
  const confirmed = confirm("Are you sure you want to clear all history?");
  if (!confirmed) return;

  localStorage.removeItem(config.historyStorageKey);
  state.currentThreadId = null;
  state.currentStepIndex = -1;

  clearMainView();
  updateHistoryUI();
}

function searchHistory(query) {
  const history = getHistory();
  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery) return history;

  return history.filter((thread) => {
    const titleMatch = thread.title.toLowerCase().includes(cleanQuery);
    const stepMatch = thread.steps.some((step) =>
      step.topic.toLowerCase().includes(cleanQuery)
    );
    return titleMatch || stepMatch;
  });
}

function updateHistoryUI(filteredHistory = null) {
  const historyList = elements.historyList;
  const template = elements.historyItemTemplate;

  if (!historyList || !template) return;

  const history = filteredHistory || getHistory();
  historyList.innerHTML = "";

  history.forEach((thread) => {
    const clone = template.content.cloneNode(true);
    const li = clone.querySelector(".history-item");
    const timestamp = clone.querySelector(".timestamp");
    const topicText = clone.querySelector(".topic-text");
    const removeBtn = clone.querySelector(".remove-btn");

    const stepCount = thread.steps.length > 1 ? ` (${thread.steps.length} steps)` : "";

    timestamp.textContent = `${new Date(thread.createdAt).toLocaleDateString()} • ${thread.template}`;
    topicText.textContent = `${thread.title}${stepCount}`;
    topicText.title = thread.steps[0]?.topic || thread.title;

    if (thread.id === state.currentThreadId) {
      li.classList.add("active-history");
    }

    li.addEventListener("click", () => loadThread(thread.id));

    removeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const confirmed = confirm(`Delete this thread: "${thread.title}"?`);
      if (confirmed) deleteThread(thread.id);
    });

    historyList.appendChild(clone);
  });
}

function updateNavControls() {
  const history = getHistory();
  const thread = history.find((item) => item.id === state.currentThreadId);

  if (!thread || thread.steps.length <= 1) {
    elements.navControls?.classList.add("hidden");
    return;
  }

  elements.navControls?.classList.remove("hidden");
  elements.prevBtn.disabled = state.currentStepIndex <= 0;
  elements.nextBtn.disabled = state.currentStepIndex >= thread.steps.length - 1;
  elements.navCounter.textContent = `${state.currentStepIndex + 1} / ${thread.steps.length}`;
}

async function handleGenerate() {
  if (state.isGenerating) {
    setStatus("⏳ Please wait, agents are still working...");
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) return;

  const topic = elements.inputTopic?.value.trim();
  if (!topic) {
    setStatus("Please enter a topic first.");
    return;
  }

  const templateName = elements.templateSelect?.value || state.currentTemplate;
  const prompts = agentPrompts[templateName] || agentPrompts.general;

  const history = getHistory();
  const currentThread = history.find((item) => item.id === state.currentThreadId);
  const lastStep = currentThread?.steps?.[state.currentStepIndex] || null;
  const followUp = isRelated(topic, lastStep?.topic || null);
  const threadId = followUp && currentThread ? currentThread.id : `thread-${Date.now()}`;

  try {
    state.isGenerating = true;
    elements.btn.disabled = true;
    elements.btn.textContent = "⏳";
    elements.navControls?.classList.add("hidden");
    clearOutputs();

    setStatus("📄 Summary Agent analyzing...");
    const summary = await callOpenRouter(prompts.summary(topic), "summary", apiKey);
    displayText(elements.textOutput, `📝 Summary:\n${summary}`);

    setStatus("✍️ Writer Agent crafting content...");
    const writer = await callOpenRouter(
      `${prompts.writer(topic)}\n\nContext from Summary Agent:\n${summary}`,
      "writer",
      apiKey
    );
    displayText(elements.writerOutput, `✍️ Writer Agent:\n${writer}`);

    setStatus("📊 Research Agent gathering insights...");
    const research = await callOpenRouter(
      `${prompts.research(topic)}\n\nContext from Summary Agent:\n${summary}`,
      "research",
      apiKey
    );
    displayText(elements.researchOutput, `📊 Research Agent:\n${research}`);

    saveStepToHistory(threadId, topic, templateName, {
      summary,
      writer,
      research,
    });

    const updatedThread = getHistory().find((item) => item.id === threadId);
    state.currentThreadId = threadId;
    state.currentStepIndex = updatedThread.steps.length - 1;

    setStatus("✅ All agents completed successfully!");
  } catch (error) {
    setStatus(`❌ Something went wrong: ${error.message}`);
  } finally {
    state.isGenerating = false;
    elements.btn.disabled = false;
    elements.btn.textContent = "➤";
    updateNavControls();
    updateHistoryUI();
    addToggleToAgents();
    saveToStorage(config.metricsStorageKey, state.metrics);
  }
}

function exportContent() {
  if (!state.currentThreadId) {
    alert("Please select a conversation from history first.");
    return;
  }

  const thread = getHistory().find((item) => item.id === state.currentThreadId);

  if (!thread) {
    alert("Could not find the selected conversation.");
    return;
  }

  const safeTitle = thread.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const blob = new Blob(
    [JSON.stringify({ ...thread, metrics: state.metrics }, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `autocreator-${safeTitle}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function toggleTheme() {
  document.body.classList.toggle("light-theme");

  const theme = document.body.classList.contains("light-theme")
    ? "light"
    : "dark";

  localStorage.setItem(config.themeStorageKey, theme);

  if (elements.themeToggle) {
    elements.themeToggle.textContent = theme === "light" ? "☀️" : "🌙";
  }
}

function updateMetricsDisplay() {
  if (!elements.metricsContent) return;

  const total = state.metrics.totalRequests;
  const successRate = total
    ? ((state.metrics.successfulRequests / total) * 100).toFixed(1)
    : 0;

  elements.metricsContent.innerHTML = `
    <p><strong>Total Requests:</strong> ${total}</p>
    <p><strong>Success Rate:</strong> ${successRate}%</p>
    <p><strong>Avg Response Time:</strong> ${state.metrics.averageResponseTime.toFixed(0)}ms</p>
  `;
}

function toggleMetrics() {
  if (!elements.metricsPanel) return;

  if (elements.metricsPanel.classList.contains("visible")) {
    elements.metricsPanel.classList.remove("visible");
  } else {
    updateMetricsDisplay();
    elements.metricsPanel.classList.add("visible");
  }
}

function addToggleToAgents() {
  const agentMessages = document.querySelectorAll(".agent-message.bot");

  agentMessages.forEach((message) => {
    if (message.querySelector(".toggle-arrow")) return;

    const toggle = document.createElement("button");
    toggle.className = "toggle-arrow";
    toggle.type = "button";
    toggle.textContent = "⯆";
    toggle.setAttribute("aria-label", "Toggle agent message");

    toggle.addEventListener("click", () => {
      message.classList.toggle("collapsed");
      toggle.textContent = message.classList.contains("collapsed") ? "⯈" : "⯆";
    });

    message.appendChild(toggle);
  });
}

function setupEventListeners() {
  elements.btn?.addEventListener("click", handleGenerate);

  elements.historySearch?.addEventListener("input", (event) => {
    updateHistoryUI(searchHistory(event.target.value));
  });

  elements.templateSelect?.addEventListener("change", (event) => {
    state.currentTemplate = event.target.value;
  });

  elements.prevBtn?.addEventListener("click", () => {
    if (state.currentStepIndex > 0) {
      loadThread(state.currentThreadId, state.currentStepIndex - 1);
    }
  });

  elements.nextBtn?.addEventListener("click", () => {
    const thread = getHistory().find((item) => item.id === state.currentThreadId);
    if (thread && state.currentStepIndex < thread.steps.length - 1) {
      loadThread(state.currentThreadId, state.currentStepIndex + 1);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      handleGenerate();
    }

    if (event.ctrlKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      exportContent();
    }

    if (event.ctrlKey && event.key.toLowerCase() === "d") {
      event.preventDefault();
      toggleTheme();
    }
  });
}

function initializeApp() {
  cacheElements();

  if (!elements.btn || !elements.inputTopic) {
    console.error("AutoCreator error: Required HTML elements were not found. Check that your IDs match the JavaScript: #generateBtn and #topicInput.");
    return;
  }

  const savedMetrics = getFromStorage(config.metricsStorageKey, null);
  if (savedMetrics) {
    state.metrics = { ...state.metrics, ...savedMetrics };
  }

  const savedTheme = localStorage.getItem(config.themeStorageKey);
  if (savedTheme === "light") {
    document.body.classList.add("light-theme");
    if (elements.themeToggle) elements.themeToggle.textContent = "☀️";
  }

  updateHistoryUI();
  updateNavControls();
  setupEventListeners();
  setStatus("Awaiting your topic...");
}

window.addEventListener("DOMContentLoaded", initializeApp);

setInterval(() => {
  saveToStorage(config.metricsStorageKey, state.metrics);
}, 30000);

// Optional: expose these if your HTML buttons use onclick="..."
window.clearAllHistory = clearAllHistory;
window.exportContent = exportContent;
window.toggleTheme = toggleTheme;
window.toggleMetrics = toggleMetrics;
