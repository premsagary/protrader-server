import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import App from './App';
import './index.css';

// Register Chart.js components globally
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
  TimeScale,
  annotationPlugin
);

// Chart.js global defaults
ChartJS.defaults.font.family = '"SF Pro Text","Inter",-apple-system,BlinkMacSystemFont,sans-serif';
ChartJS.defaults.font.size = 11;
ChartJS.defaults.animation.duration = 300;
ChartJS.defaults.responsive = true;
ChartJS.defaults.maintainAspectRatio = false;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
