import React, { useContext } from "react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../UserContext";
import "./Login.css";

const Login = () => {
  const { login } = useContext(UserContext);
  const navigate = useNavigate();
  const API_URL = process.env.REACT_APP_API_URL;
  const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

  const handleLoginSuccess = async (credentialResponse) => {
    try {
      // Send Google token to backend
      const response = await axios.post(`${API_URL}/api/auth/google-login`, {
        googleToken: credentialResponse.credential,
      });

      const { token, user } = response.data;

      // Store token and user in context
      login(user, token);

      // Redirect to app
      navigate("/");
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login failed. Please try again.");
    }
  };

  const handleLoginError = () => {
    console.log("Login Failed");
    alert("Login failed. Please try again.");
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="login-container">
        <div className="login-box">
          <h1>📚 Code Doc Generator</h1>
          <p>Generate documentation with AI</p>

          <div className="login-button">
            <GoogleLogin
              onSuccess={handleLoginSuccess}
              onError={handleLoginError}
            />
          </div>

          <p className="login-info">
            Sign in with your Google account to get started
          </p>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
};

export default Login;
