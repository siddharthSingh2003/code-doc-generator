import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
} from "react";
import Editor from "@monaco-editor/react";
import axios from "axios";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { UserProvider, UserContext } from "./UserContext";
import Login from "./pages/Login";
import "./App.css";

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

const RootApp = () => {
  return (
    <UserProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </UserProvider>
  );
};

const ProtectedRoute = ({ children }) => {
  const { token, loading } = useContext(UserContext);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!token) {
    return <Navigate to="/login" />;
  }

  return children;
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
  const [showSearch, setShowSearch] = useState(false);
  const [searchLanguage, setSearchLanguage] = useState("");
  const [searchProject, setSearchProject] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [stats, setStats] = useState([]);

  const { token, user, logout } = useContext(UserContext);
  const API_URL = process.env.REACT_APP_API_URL;

  // Create axios instance with token
  // ✅ Memoize axiosInstance - only recreate when token/API_URL changes
  const axiosInstance = useMemo(
    () =>
      axios.create({
        baseURL: API_URL,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
    [API_URL, token], // Only recreate when these change
  );

  // Load history
  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const response = await axiosInstance.get("/api/docs");
      setHistory(response.data.data || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [axiosInstance]);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/api/stats");
      setStats(response.data.data || []);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  }, [axiosInstance]);

  useEffect(() => {
    loadHistory();
    loadStats();
  }, [loadHistory, loadStats]);

  // Search
  const handleSearch = async (e) => {
    e.preventDefault();
    try {
      setLoadingSearch(true);
      setError("");

      const params = new URLSearchParams();
      if (searchLanguage) params.append("language", searchLanguage);
      if (searchProject) params.append("projectName", searchProject);
      params.append("limit", "20");

      const response = await axiosInstance.get(`/api/search?${params}`);
      setSearchResults(response.data.data || []);
    } catch (err) {
      setError("Failed to search");
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleClearSearch = () => {
    setShowSearch(false);
    setSearchLanguage("");
    setSearchProject("");
    setSearchResults([]);
  };

  // Load from history
  const loadFromHistory = async (docId) => {
    try {
      const response = await axiosInstance.get(`/api/docs/${docId}`);
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

  // Delete from history
  const deleteFromHistory = async (docId) => {
    try {
      await axiosInstance.delete(`/api/docs/${docId}`);
      setHistory(history.filter((h) => h._id !== docId));
      if (currentDocId === docId) {
        setCurrentDocId(null);
        setOutputs({ docs: "", comments: "", readme: "" });
      }
      loadStats();
    } catch (err) {
      setError("Failed to delete documentation");
    }
  };

  // Generate docs
  const handleGenerateDocs = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await axiosInstance.post("/api/generate-docs", {
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

  // Generate comments
  const handleGenerateComments = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await axiosInstance.post("/api/generate-comments", {
        code,
        language,
      });

      setOutputs((prev) => ({
        ...prev,
        comments: response.data.comments,
      }));

      if (currentDocId) {
        await axiosInstance.put(`/api/docs/${currentDocId}`, {
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

      const response = await axiosInstance.post("/api/generate-readme", {
        code,
        language,
        projectName,
      });

      setOutputs((prev) => ({
        ...prev,
        readme: response.data.readme,
      }));

      if (currentDocId) {
        await axiosInstance.put(`/api/docs/${currentDocId}`, {
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

  // Copy to clipboard
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

  // Download file
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
          await axiosInstance.delete(`/api/docs/${doc._id}`);
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

  // Export all
  const handleExportAll = async () => {
    try {
      const response = await axiosInstance.get("/api/docs/export/json", {
        responseType: "blob",
      });

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

  // Rest of your JSX code stays the same...
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
          {/* Left Sidebar */}
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
                      value={searchProject}
                      onChange={(e) => setSearchProject(e.target.value)}
                      placeholder="Search..."
                      className="search-input"
                    />
                  </div>

                  <button
                    type="submit"
                    className="search-btn"
                    disabled={loadingSearch}
                  >
                    {loadingSearch ? "Searching..." : "🔍 Search"}
                  </button>
                </form>

                <div className="sidebar-header" style={{ marginTop: "20px" }}>
                  Stats
                </div>

                <div className="stats-list">
                  {stats.map((stat) => (
                    <div key={stat._id} className="stat-item">
                      <span>{stat._id}</span>
                      <span>{stat.count}</span>
                    </div>
                  ))}
                </div>

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
                          <div>{item.projectName}</div>
                          <small>{item.language}</small>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Editor */}
          <div className="editor-area">
            <div className="editor-header">
              <div className="input-group">
                <label>Project Name</label>
                <input
                  className="input-field"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. UserAuthModule"
                />
              </div>

              <div className="input-group">
                <label>Language</label>
                <select
                  className="input-field"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
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

            <div className="split-view">
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

              <div className="output-pane">
                <div className="pane-tab">📋 Documentation</div>

                <div className="output-tabs">
                  <button
                    className={`output-tab ${
                      activeTab === "docs" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("docs")}
                  >
                    📋 Docs
                  </button>

                  <button
                    className={`output-tab ${
                      activeTab === "comments" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("comments")}
                  >
                    💬 Comments
                  </button>

                  <button
                    className={`output-tab ${
                      activeTab === "readme" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("readme")}
                  >
                    📄 README
                  </button>
                </div>

                <div className="output-content">
                  {error && <div className="error-message">{error}</div>}

                  {loading ? (
                    <div className="loading">
                      <p>Generating...</p>
                    </div>
                  ) : outputs[activeTab] ? (
                    <>
                      <div className="output-button-group">
                        <button onClick={handleCopy}>
                          {copiedTab === activeTab ? "✓ Copied" : "📋 Copy"}
                        </button>

                        <button onClick={handleDownload}>⬇ Download</button>
                      </div>

                      <div className="output-text">{outputs[activeTab]}</div>
                    </>
                  ) : (
                    <div className="empty-state">
                      <p>No {activeTab} generated yet</p>
                      <small>Click a button below to generate</small>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="action-buttons">
              <button
                className="btn btn-primary"
                disabled={loading}
                onClick={handleGenerateDocs}
              >
                ✨ Generate Docs
              </button>

              <button
                className="btn btn-secondary"
                disabled={loading}
                onClick={handleGenerateComments}
              >
                💬 Add Comments
              </button>

              <button
                className="btn btn-secondary"
                disabled={loading}
                onClick={handleGenerateREADME}
              >
                📖 Generate README
              </button>
            </div>
          </div>

          {/* History */}
          <div className="right-sidebar">
            <div className="sidebar-header">History ({history.length})</div>

            <div className="history-items">
              {history.map((item) => (
                <div
                  key={item._id}
                  className={`history-item ${
                    currentDocId === item._id ? "active" : ""
                  }`}
                >
                  <div
                    className="history-content"
                    onClick={() => loadFromHistory(item._id)}
                  >
                    <div>{item.projectName || "Untitled Project"}</div>
                    <small>{item.language}</small>
                    <small>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </small>
                  </div>

                  <button
                    className="delete-btn"
                    onClick={() => deleteFromHistory(item._id)}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>

            <div className="sidebar-header" style={{ marginTop: "20px" }}>
              Settings
            </div>
            <div className="sidebar-link">👤 {user?.name}</div>
            <div
              className="sidebar-link danger"
              onClick={() => {
                logout();
                window.location.href = "/login";
              }}
            >
              🚪 Logout
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

      <div className="status-bar">
        <div>✓ Ready</div>
        <div>{language.toUpperCase()} • UTF-8</div>
      </div>
    </div>
  );
}

export default RootApp;
