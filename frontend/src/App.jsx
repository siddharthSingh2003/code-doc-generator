import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  useRef,
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
import "./App_Mobile_Optimized.css";

// Suppress ResizeObserver warning
const ignoreResizeObserverLoop = (e) => {
  const resizeObserverErrDiv = document.getElementById(
    "webpack-dev-server-client-overlay-div",
  );
  const resizeObserverErr = document.getElementById(
    "webpack-dev-server-client-overlay",
  );
  if (
    e.message === "ResizeObserver loop limit exceeded" ||
    e.message ===
      "ResizeObserver loop completed with undelivered notifications."
  ) {
    if (resizeObserverErrDiv) {
      resizeObserverErrDiv.setAttribute("style", "display: none");
    }
    if (resizeObserverErr) {
      resizeObserverErr.setAttribute("style", "display: none");
    }
  }
};
window.addEventListener("error", ignoreResizeObserverLoop);

const EXTENSION_LANGUAGE_MAP = {
  py: "python",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  go: "go",
  java: "java",
  c: "cpp",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  h: "cpp",
  hpp: "cpp",
};

const getLanguageFromFilename = (filename) => {
  const ext = filename.split(".").pop().toLowerCase();
  return EXTENSION_LANGUAGE_MAP[ext] || "javascript";
};

// Checked in priority order: most distinctive/rare markers first, so a
// language never gets misdetected just because it shares common tokens
// (e.g. TypeScript before JavaScript, since TS syntax can't appear in valid JS).
const LANGUAGE_DETECTORS = [
  {
    lang: "go",
    test: (c) => /^\s*package\s+\w+/m.test(c) && /\bfunc\s+\w*\s*\(/.test(c),
  },
  {
    lang: "java",
    test: (c) =>
      /\bpublic\s+static\s+void\s+main\s*\(/.test(c) ||
      (/\bpublic\s+class\s+\w+/.test(c) &&
        /\bSystem\.out\.println\s*\(/.test(c)),
  },
  {
    lang: "cpp",
    test: (c) =>
      /#include\s*<[\w.]+>/.test(c) &&
      (/\bstd::/.test(c) ||
        /\b(cout|cin)\b/.test(c) ||
        /\bint\s+main\s*\(/.test(c)),
  },
  {
    lang: "python",
    test: (c) =>
      /^\s*def\s+\w+\s*\(.*\)\s*:/m.test(c) ||
      /^\s*(elif|except)\b.*:/m.test(c) ||
      /^\s*from\s+\w+\s+import\b/m.test(c) ||
      (/^\s*import\s+\w+/m.test(c) && /:\s*$/m.test(c)),
  },
  {
    lang: "typescript",
    test: (c) =>
      /\binterface\s+\w+\s*{/.test(c) ||
      /\benum\s+\w+\s*{/.test(c) ||
      /:\s*(string|number|boolean|any|void|unknown)\b/.test(c) ||
      (/\bclass\s+\w+/.test(c) && /\bimplements\s+\w+/.test(c)),
  },
  {
    lang: "javascript",
    test: (c) =>
      /\bconsole\.log\s*\(/.test(c) ||
      /^\s*(const|let|var)\s+\w+\s*=/m.test(c) ||
      /=>/.test(c) ||
      /\brequire\s*\(/.test(c) ||
      /\bfunction\s+\w*\s*\(/.test(c),
  },
];

const detectLanguageFromCode = (code) => {
  if (!code || code.trim().length < 8) return null;
  const match = LANGUAGE_DETECTORS.find(({ test }) => test(code));
  return match ? match.lang : null;
};

const sortTreeChildren = (children) =>
  Object.values(children).sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

// const debounce = (func, delay) => {
//   let timeoutId;
//   return (...args) => {
//     clearTimeout(timeoutId);
//     timeoutId = setTimeout(() => func(...args), delay);
//   };
// };

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

  const [showLeftSidebar, setShowLeftSidebar] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);

  const [fileTree, setFileTree] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [activeFilePath, setActiveFilePath] = useState(null);
  const [activeFileName, setActiveFileName] = useState("");

  const [isDesktop, setIsDesktop] = useState(
    () => window.innerWidth >= 768,
  );
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [editorPaneRatio, setEditorPaneRatio] = useState(0.5);
  const splitViewRef = useRef(null);

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    let debounceTimer;

    const handleResize = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const desktop = window.innerWidth >= 768;
        setIsDesktop(desktop);
        if (desktop) {
          setShowLeftSidebar(false);
          setShowRightSidebar(false);
        }
      }, 250);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);
  // Create axios instance with token
  // ✅ Memoize axiosInstance - only recreate when token/API_URL changes
  const axiosInstance = useMemo(() => {
    const instance = axios.create({
      baseURL: API_URL,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    instance.interceptors.response.use(
      (response) => response,
      (err) => {
        if (err.response?.status === 401) {
          logout();
          window.location.href = "/login";
        }
        return Promise.reject(err);
      },
    );

    return instance;
  }, [API_URL, token, logout]); // Only recreate when these change

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

  // Build a nested tree from the flat FileList a folder upload produces
  const handleFolderUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const rootName = files[0].webkitRelativePath.split("/")[0];
    const root = { name: rootName, type: "folder", children: {} };

    for (const file of files) {
      const parts = file.webkitRelativePath.split("/");
      let node = root;
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        if (isFile) {
          node.children[part] = { name: part, type: "file", file };
        } else {
          if (!node.children[part]) {
            node.children[part] = { name: part, type: "folder", children: {} };
          }
          node = node.children[part];
        }
      }
    }

    setFileTree(root);
    setExpandedFolders(new Set([rootName]));
    setActiveFilePath(null);
    setActiveFileName("");
    e.target.value = "";
  };

  // Add one or more loose files (no folder structure) into the tree,
  // merging them into the existing root if one is already open
  const handleFilesUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const rootName = fileTree ? fileTree.name : "My Files";
    const newChildren = fileTree ? { ...fileTree.children } : {};

    for (const file of files) {
      newChildren[file.name] = { name: file.name, type: "file", file };
    }

    setFileTree({ name: rootName, type: "folder", children: newChildren });
    setExpandedFolders((prev) => new Set(prev).add(rootName));
    e.target.value = "";
  };

  // Remove a folder (and everything under it) from the uploaded file tree
  const deleteFolder = (e, path, name) => {
    e.stopPropagation();
    if (!window.confirm(`Delete folder "${name}" and all its contents?`)) {
      return;
    }

    setFileTree((prevRoot) => {
      if (!prevRoot) return prevRoot;
      if (path === prevRoot.name) return null;

      const segments = path.split("/").slice(1);
      const newRoot = { ...prevRoot, children: { ...prevRoot.children } };
      let node = newRoot;
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        const child = node.children[seg];
        if (!child) return prevRoot;
        const newChild = { ...child, children: { ...child.children } };
        node.children[seg] = newChild;
        node = newChild;
      }
      delete node.children[segments[segments.length - 1]];
      return newRoot;
    });

    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.delete(path);
      for (const p of prev) {
        if (p.startsWith(`${path}/`)) next.delete(p);
      }
      return next;
    });

    if (activeFilePath === path || activeFilePath?.startsWith(`${path}/`)) {
      setActiveFilePath(null);
      setActiveFileName("");
    }
  };

  const toggleFolder = (path) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleOpenFile = async (node, path) => {
    try {
      const content = await node.file.text();
      setCode(content);
      setLanguage(getLanguageFromFilename(node.name));
      setActiveFilePath(path);
      setActiveFileName(node.name);
    } catch (err) {
      setError("Failed to read file");
    }
  };

  const renderTreeNode = (node, path, depth) => {
    if (node.type === "folder") {
      const isExpanded = expandedFolders.has(path);
      return (
        <div key={path}>
          <div
            className="folder"
            style={{ paddingLeft: `${8 + depth * 14}px` }}
            onClick={() => toggleFolder(path)}
          >
            <span>
              {isExpanded ? "▼" : "▶"} {node.name}
            </span>
            <button
              className="delete-btn folder-delete-btn"
              title="Delete folder"
              onClick={(e) => deleteFolder(e, path, node.name)}
            >
              🗑️
            </button>
          </div>
          {isExpanded &&
            sortTreeChildren(node.children).map((child) =>
              renderTreeNode(child, `${path}/${child.name}`, depth + 1),
            )}
        </div>
      );
    }

    return (
      <div
        key={path}
        className={`file ${activeFilePath === path ? "active" : ""}`}
        style={{ paddingLeft: `${24 + depth * 14}px` }}
        onClick={() => handleOpenFile(node, path)}
      >
        📄 {node.name}
      </div>
    );
  };

  // Drag-resize: left sidebar width
  const handleSidebarResizeStart = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      setSidebarWidth(Math.min(500, Math.max(180, startWidth + delta)));
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // Drag-resize: editor pane vs documentation pane
  const handleSplitResizeStart = (e) => {
    e.preventDefault();
    const container = splitViewRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const onMouseMove = (moveEvent) => {
      const ratio = (moveEvent.clientX - rect.left) / rect.width;
      setEditorPaneRatio(Math.min(0.8, Math.max(0.2, ratio)));
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
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
          onClick={() => {
            setShowSearch(!showSearch);
            setShowLeftSidebar(!showLeftSidebar);
          }}
        >
          🔍
        </div>
        <div className="activity-icon" title="Run">
          ▶
        </div>
        <div className="activity-icon" title="Settings">
          ⚙
        </div>
        <div className="activity-icon activity-icon-bottom" title={user?.name || "Profile"}>
          👤
        </div>
        <div
          className="activity-icon danger"
          title="Logout"
          onClick={() => {
            logout();
            window.location.href = "/login";
          }}
        >
          🚪
        </div>
        <div
          className="activity-icon"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </div>
      </div>

      {/* Main Container */}
      <div className="main-container">
        {/* Top Tabs */}
        {/* <div className="top-tabs">
          <div className="tab-item active">📄 input.py</div>
          <div className="tab-item">output.md</div>
        </div> */}

        {/* Workspace */}
        <div className="workspace">
          {/* Left Sidebar */}
          <div
            className={`left-sidebar ${showLeftSidebar ? "open" : ""}`}
            style={isDesktop ? { width: sidebarWidth } : undefined}
          >
            {!showSearch ? (
              <>
                <div className="sidebar-header">
                  Explorer
                  <div className="sidebar-header-actions">
                    <label
                      className="close-search-btn upload-folder-btn"
                      title="Upload File(s)"
                    >
                      📄
                      <input
                        type="file"
                        multiple
                        onChange={handleFilesUpload}
                      />
                    </label>
                    <label
                      className="close-search-btn upload-folder-btn"
                      title="Upload Project Folder"
                    >
                      📂
                      <input
                        type="file"
                        webkitdirectory="true"
                        directory=""
                        multiple
                        onChange={handleFolderUpload}
                      />
                    </label>
                  </div>
                </div>

                <div className="file-tree">
                  {fileTree ? (
                    renderTreeNode(fileTree, fileTree.name, 0)
                  ) : (
                    <div className="empty-tree">
                      <p>No folder opened</p>
                      <small>Click 📄 to upload files or 📂 to upload a folder</small>
                    </div>
                  )}
                </div>
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

          {isDesktop && (
            <div
              className="resize-handle"
              onMouseDown={handleSidebarResizeStart}
            />
          )}

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

            <div className="split-view" ref={splitViewRef}>
              <div
                className="editor-pane"
                style={
                  isDesktop
                    ? { flex: `0 0 calc(${editorPaneRatio * 100}% - 3px)` }
                    : undefined
                }
              >
                <div className="pane-tab">📄 {activeFileName || "input.py"}</div>

                <Editor
                  height="100%"
                  language={language}
                  value={code}
                  onChange={(value) => {
                    const newCode = value || "";
                    setCode(newCode);
                    const detected = detectLanguageFromCode(newCode);
                    if (detected && detected !== language) {
                      setLanguage(detected);
                    }
                  }}
                  theme={theme === "dark" ? "vs-dark" : "light"}
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

              {isDesktop && (
                <div
                  className="resize-handle"
                  onMouseDown={handleSplitResizeStart}
                />
              )}

              <div
                className="output-pane"
                style={isDesktop ? { flex: 1 } : undefined}
              >
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
          <div className={`right-sidebar ${showRightSidebar ? "open" : ""}`}>
            <div className="sidebar-header">
              History ({history.length})
              {loadingHistory && <span className="spinner-mini"></span>}
              {history.length > 0 && (
                <button
                  className="close-search-btn clear-all-btn"
                  onClick={handleClearHistory}
                >
                  Clear All
                </button>
              )}
            </div>

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
          </div>
        </div>
      </div>

      {/* <div className="status-bar">
        <div>✓ Ready</div>
        <div>{language.toUpperCase()} • UTF-8</div>
      </div> */}
    </div>
  );
}

export default RootApp;
