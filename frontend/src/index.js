import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import RootApp from './App';
import reportWebVitals from './reportWebVitals';
// import RootApp from './RootApp';

const savedTheme = localStorage.getItem('theme');
const initialTheme =
  savedTheme === 'light' || savedTheme === 'dark'
    ? savedTheme
    : window.matchMedia?.('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
document.documentElement.setAttribute('data-theme', initialTheme);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* <App /> */}
    <RootApp />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
