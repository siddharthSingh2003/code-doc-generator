import React, { useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import axios from "axios";
import "./App.css";

// eslint-disable-next-line no-unused-vars
const API_URL = process.env.REACT_APP_API_URL;

// Debounce helper function
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

function App() {
  const [code, setCode] = useState(
    "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)",
  );
  const [language, setLanguage] = useState("python");
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("docs");
  const [outputs, setOutputs] = useState({
    docs: "",
    comments: "",
    readme: "",
  });
  const [copiedTab, setCopiedTab] = useState("");
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentDocId, setCurrentDocId] = useState(null);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchLanguage, setSearchLanguage] = useState("");
  const [searchProject, setSearchProject] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [stats, setStats] = useState([]);

  const API_URL = process.env.REACT_APP_API_URL;

  // Load documentation history from database
  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const response = await axios.get(`${API_URL}/api/docs`);
      setHistory(response.data.data || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [API_URL]);

  // Load stats (count by language)
  const loadStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/stats`);
      setStats(response.data.data || []);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  }, [API_URL]);

  // Load history on component mount
  useEffect(() => {
    loadHistory();
    loadStats();
  }, [loadHistory, loadStats]);

  // Search documentations
  const handleSearch = async (e) => {
    e.preventDefault();
    try {
      setLoadingSearch(true);
      setError("");

      const params = new URLSearchParams();
      if (searchLanguage) params.append("language", searchLanguage);
      if (searchProject) params.append("projectName", searchProject);
      params.append("limit", "20");

      const response = await axios.get(`${API_URL}/api/search?${params}`);
      setSearchResults(response.data.data || []);
    } catch (err) {
      setError("Failed to search");
    } finally {
      setLoadingSearch(false);
    }
  };

  // Clear search
  const handleClearSearch = () => {
    setShowSearch(false);
    setSearchLanguage("");
    setSearchProject("");
    setSearchResults([]);
  };

  // Load a specific documentation from history
  const loadFromHistory = async (docId) => {
    try {
      const response = await axios.get(`${API_URL}/api/docs/${docId}`);
      const doc = response.data.data;

      setCode(doc.code);
      setLanguage(doc.language);
      setProjectName(doc.projectName);
      setOutputs({
        docs: doc.documentation || "",
        comments: doc.comments || "",
        readme: doc.readme || "",
      });
      setCurrentDocId(docId);
      setActiveTab("docs");
      setError("");
      handleClearSearch();
    } catch (err) {
      setError("Failed to load documentation");
    }
  };

  // Delete documentation from history
  const deleteFromHistory = async (docId) => {
    try {
      await axios.delete(`${API_URL}/api/docs/${docId}`);
      setHistory(history.filter((h) => h._id !== docId));
      if (currentDocId === docId) {
        setCurrentDocId(null);
        setOutputs({ docs: "", comments: "", readme: "" });
      }
      setError("");
      loadStats();
    } catch (err) {
      setError("Failed to delete documentation");
    }
  };

  // Generate Documentation
  const handleGenerateDocs = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await axios.post(`${API_URL}/api/generate-docs`, {
        code,
        language,
        projectName: projectName || "Untitled Project",
      });

      setOutputs((prev) => ({
        ...prev,
        docs: response.data.documentation,
      }));
      setCurrentDocId(response.data.id);
      setActiveTab("docs");
      loadHistory();
      loadStats();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to generate documentation");
    } finally {
      setLoading(false);
    }
  };

  // Generate Comments
  const handleGenerateComments = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await axios.post(`${API_URL}/api/generate-comments`, {
        code,
        language,
      });

      setOutputs((prev) => ({
        ...prev,
        comments: response.data.comments,
      }));

      if (currentDocId) {
        await axios.put(`${API_URL}/api/docs/${currentDocId}`, {
          comments: response.data.comments,
        });
      }

      setActiveTab("comments");
      loadHistory();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to generate comments");
    } finally {
      setLoading(false);
    }
  };

  // Generate README
  const handleGenerateREADME = async () => {
    try {
      setLoading(true);
      setError("");

      if (!projectName.trim()) {
        setError("Project name is required for README generation");
        setLoading(false);
        return;
      }

      const response = await axios.post(`${API_URL}/api/generate-readme`, {
        code,
        language,
        projectName,
      });

      setOutputs((prev) => ({
        ...prev,
        readme: response.data.readme,
      }));

      if (currentDocId) {
        await axios.put(`${API_URL}/api/docs/${currentDocId}`, {
          readme: response.data.readme,
        });
      }

      setActiveTab("readme");
      loadHistory();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to generate README");
    } finally {
      setLoading(false);
    }
  };

  // Copy to Clipboard
  const handleCopy = async () => {
    try {
      const textToCopy = outputs[activeTab];
      await navigator.clipboard.writeText(textToCopy);
      setCopiedTab(activeTab);
      setTimeout(() => setCopiedTab(""), 2000);
    } catch (err) {
      setError("Failed to copy to clipboard");
    }
  };

  // Download as file
  const handleDownload = () => {
    try {
      const textToDownload = outputs[activeTab];
      const element = document.createElement("a");
      const file = new Blob([textToDownload], { type: "text/plain" });

      let filename = "output";
      if (activeTab === "readme") {
        filename = "README.md";
      } else if (activeTab === "comments") {
        filename = `${projectName || "output"}_commented.${language}`;
      } else {
        filename = `${projectName || "output"}_documentation.md`;
      }

      element.href = URL.createObjectURL(file);
      element.download = filename;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (err) {
      setError("Failed to download file");
    }
  };

  // Clear all history
  const handleClearHistory = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete all history? This cannot be undone.",
      )
    ) {
      try {
        for (let doc of history) {
          await axios.delete(`${API_URL}/api/docs/${doc._id}`);
        }
        setHistory([]);
        setCurrentDocId(null);
        setOutputs({ docs: "", comments: "", readme: "" });
        loadStats();
      } catch (err) {
        setError("Failed to clear history");
      }
    }
  };

  // Export all documentations as JSON
  const handleExportAll = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/docs/export/json`, {
        responseType: "blob", // Important: get binary data
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `documentation-export-${new Date().getTime()}.json`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to export all documentations");
    }
  };

  return (
    <div className="vs-code-container">
      {/* Activity Bar */}
      <div className="activity-bar">
        <div className="activity-icon active" title="Explorer">
          📁
        </div>
        <div
          className="activity-icon"
          title="Search"
          onClick={() => setShowSearch(!showSearch)}
        >
          🔍
        </div>
        <div className="activity-icon" title="Run">
          ▶
        </div>
        <div className="activity-icon" title="Settings">
          ⚙
        </div>
      </div>

      {/* Main Container */}
      <div className="main-container">
        {/* Top Tabs */}
        <div className="top-tabs">
          <div className="tab-item active">📄 input.py</div>
          <div className="tab-item">output.md</div>
        </div>

        {/* Workspace */}
        <div className="workspace">
          {/* Left Sidebar - Explorer or Search */}
          <div className="left-sidebar">
            {!showSearch ? (
              <>
                <div className="sidebar-header">Explorer</div>
                <div className="file-tree">
                  <div className="folder">▼ AI Doc Generator</div>
                  <div className="file active">📄 input.py</div>
                  <div className="file">📄 output.md</div>
                  <div className="file">📄 README.md</div>
                </div>

                <div className="sidebar-header" style={{ marginTop: "20px" }}>
                  Settings
                </div>
                <label className="checkbox">
                  <input type="checkbox" defaultChecked />
                  <span>Dark Mode</span>
                </label>
              </>
            ) : (
              <>
                <div className="sidebar-header">
                  Search
                  <button
                    className="close-search-btn"
                    onClick={() => setShowSearch(false)}
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSearch} className="search-form">
                  <div className="search-input-group">
                    <label>Language</label>
                    <select
                      value={searchLanguage}
                      onChange={(e) => setSearchLanguage(e.target.value)}
                      className="search-input"
                    >
                      <option value="">All Languages</option>
                      <option value="python">🐍 Python</option>
                      <option value="javascript">🟨 JavaScript</option>
                      <option value="typescript">🔵 TypeScript</option>
                      <option value="go">🟩 Go</option>
                      <option value="java">☕ Java</option>
                      <option value="cpp">⚙️ C++</option>
                    </select>
                  </div>

                  <div className="search-input-group">
                    <label>Project Name</label>
                    <input
                      type="text"
                      placeholder="Search projects..."
                      value={searchProject}
                      onChange={debounce(
                        (e) => setSearchProject(e.target.value),
                        300,
                      )}
                      className="search-input"
                    />
                  </div>

                  <button
                    type="submit"
                    className="search-btn"
                    disabled={loadingSearch}
                  >
                    {loadingSearch ? "🔍 Searching..." : "🔍 Search"}
                  </button>
                </form>

                {/* Stats */}
                <div className="sidebar-header" style={{ marginTop: "20px" }}>
                  Stats
                </div>
                <div className="stats-list">
                  {stats.map((stat) => (
                    <div key={stat._id} className="stat-item">
                      <span className="stat-lang">{stat._id}</span>
                      <span className="stat-count">{stat.count}</span>
                    </div>
                  ))}
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <>
                    <div
                      className="sidebar-header"
                      style={{ marginTop: "20px" }}
                    >
                      Results ({searchResults.length})
                    </div>
                    <div className="search-results">
                      {searchResults.map((item) => (
                        <div
                          key={item._id}
                          className="search-result-item"
                          onClick={() => loadFromHistory(item._id)}
                        >
                          <div className="result-name">{item.projectName}</div>
                          <div className="result-lang">{item.language}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {searchResults.length === 0 &&
                  (searchLanguage || searchProject) &&
                  !loadingSearch && (
                    <div className="empty-search">
                      <small>No results found</small>
                    </div>
                  )}
              </>
            )}
          </div>

          {/* Center - Editor Area */}
          <div className="editor-area">
            {/* Editor Header */}
            <div className="editor-header">
              <div className="input-group">
                <label>Project Name</label>
                <input
                  type="text"
                  placeholder="e.g., UserAuthModule"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="input-group">
                <label>Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="input-field"
                >
                  <option value="python">🐍 Python</option>
                  <option value="javascript">🟨 JavaScript</option>
                  <option value="typescript">🔵 TypeScript</option>
                  <option value="go">🟩 Go</option>
                  <option value="java">☕ Java</option>
                  <option value="cpp">⚙️ C++</option>
                </select>
              </div>
            </div>

            {/* Split View */}
            <div className="split-view">
              {/* Code Editor */}
              <div className="editor-pane">
                <div className="pane-tab">📄 input.py</div>
                <Editor
                  height="100%"
                  language={language}
                  value={code}
                  onChange={(value) => setCode(value || "")}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                  }}
                />
                <div className="editor-status-bar">
                  <span>{language.toUpperCase()} • UTF-8 • LF</span>
                  <span>Ln 1, Col 1</span>
                </div>
              </div>

              {/* Output Panel */}
              <div className="output-pane">
                <div className="pane-tab">📋 Documentation</div>

                {/* Output Tabs */}
                <div className="output-tabs">
                  <button
                    className={`output-tab ${activeTab === "docs" ? "active" : ""}`}
                    onClick={() => setActiveTab("docs")}
                  >
                    📋 Docs
                  </button>
                  <button
                    className={`output-tab ${activeTab === "comments" ? "active" : ""}`}
                    onClick={() => setActiveTab("comments")}
                  >
                    💬 Comments
                  </button>
                  <button
                    className={`output-tab ${activeTab === "readme" ? "active" : ""}`}
                    onClick={() => setActiveTab("readme")}
                  >
                    📄 README
                  </button>
                </div>

                {/* Output Content */}
                <div className="output-content">
                  {error && <div className="error-message">❌ {error}</div>}

                  {loading && (
                    <div className="loading">
                      <div className="spinner"></div>
                      <p>Generating...</p>
                    </div>
                  )}

                  {!loading && outputs[activeTab] && (
                    <>
                      <div className="output-button-group">
                        <button
                          className={`copy-button ${copiedTab === activeTab ? "copied" : ""}`}
                          onClick={handleCopy}
                        >
                          {copiedTab === activeTab ? "✓ Copied!" : "📋 Copy"}
                        </button>
                        <button
                          className="download-button"
                          onClick={handleDownload}
                        >
                          ⬇️ Download
                        </button>
                      </div>
                      <div className="output-text">{outputs[activeTab]}</div>
                    </>
                  )}

                  {!loading && !outputs[activeTab] && (
                    <div className="empty-state">
                      <p>No {activeTab} generated yet</p>
                      <small>Click a button below to generate</small>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button
                onClick={handleGenerateDocs}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? "Generating..." : "✨ Generate Docs"}
              </button>
              <button
                onClick={handleGenerateComments}
                disabled={loading}
                className="btn btn-secondary"
              >
                💬 Add Comments
              </button>
              <button
                onClick={handleGenerateREADME}
                disabled={loading}
                className="btn btn-secondary"
              >
                📖 Generate README
              </button>
            </div>
          </div>

          {/* Right Sidebar - History */}
          <div className="right-sidebar">
            <div className="sidebar-header">
              History ({history.length})
              {loadingHistory && <span className="spinner-mini"></span>}
            </div>

            <div className="history-items">
              {history.length === 0 ? (
                <div className="empty-history">
                  <p>No history yet</p>
                  <small>Generate documentation to see history</small>
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item._id}
                    className={`history-item ${currentDocId === item._id ? "active" : ""}`}
                  >
                    <div
                      className="history-content"
                      onClick={() => loadFromHistory(item._id)}
                    >
                      <div className="history-name">
                        {item.projectName || "Untitled"}
                      </div>
                      <div className="history-lang">{item.language}</div>
                      <div className="history-date">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFromHistory(item._id);
                      }}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="sidebar-header" style={{ marginTop: "20px" }}>
              Settings
            </div>
            {history.length > 0 && (
              <>
                <div className="sidebar-link" onClick={handleExportAll}>
                  📥 Export All as JSON
                </div>
                <div
                  className="sidebar-link danger"
                  onClick={handleClearHistory}
                >
                  🗑️ Clear All History
                </div>
              </>
            )}
            <div className="sidebar-link">⚙️ Preferences</div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <div>✓ Ready</div>
        <div>{language.toUpperCase()} • UTF-8</div>
      </div>
    </div>
  );
}

export default App;
