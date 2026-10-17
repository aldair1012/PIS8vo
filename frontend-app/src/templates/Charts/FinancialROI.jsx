import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function FinancialROI({ strategies }) {
  const isLightTheme = document.body.classList.contains('light-theme');
  const textColor = isLightTheme ? '#020617' : '#ffffff';
  const tickColor = isLightTheme ? '#0f172a' : '#ffffff';
  const gridColor = isLightTheme ? 'rgba(51, 65, 85, 0.35)' : 'rgba(255, 255, 255, 0.28)';
  const borderColor = isLightTheme ? '#1e293b' : 'rgba(255, 255, 255, 0.6)';
  const tooltipBg = isLightTheme ? 'rgba(255, 255, 255, 0.98)' : 'rgba(15, 23, 42, 0.95)';
  const tooltipBorder = isLightTheme ? 'rgba(15, 23, 42, 0.18)' : 'rgba(255, 255, 255, 0.1)';
  const tooltipTitle = isLightTheme ? '#0f172a' : '#f8fafc';
  const tooltipBody = isLightTheme ? '#334155' : 'rgba(255, 255, 255, 0.8)';

  const labels = (strategies || []).map(s => s.nombre);
  const roiData = (strategies || []).map(s => s.roi);

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'ROI %',
        data: roiData,
        backgroundColor: [
          'rgba(59, 130, 246, 0.48)',
          'rgba(234, 179, 8, 0.45)',
          'rgba(22, 163, 74, 0.45)',
          'rgba(142, 68, 173, 0.45)'
        ],
        borderColor: [
          '#2563eb',
          '#ca8a04',
          '#15803d',
          '#6d28d9'
        ],
        borderWidth: 1.8,
        borderRadius: 10,
        maxBarThickness: 34,
        barPercentage: 0.88,
        categoryPercentage: 0.88,
        hoverBackgroundColor: [
          'rgba(59, 130, 246, 0.70)',
          'rgba(234, 179, 8, 0.70)',
          'rgba(22, 163, 74, 0.70)',
          'rgba(142, 68, 173, 0.70)'
        ],
        xAxisID: 'xROI',
      }
    ]
  };

  const options = {
    indexAxis: 'y', // Turn it into a horizontal bar chart!
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 4, bottom: 2, left: 4, right: 10 }
    },
    font: {
      family: 'Plus Jakarta Sans, sans-serif'
    },
    animation: {
      duration: 800,
      easing: 'easeOutQuart'
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        borderWidth: 1.5,
        titleColor: tooltipTitle,
        bodyColor: tooltipBody,
        titleFont: { size: 14, weight: '800' },
        bodyFont: { size: 13, weight: '600' },
        cornerRadius: 8,
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (item) => {
            const strategy = strategies[item.dataIndex];
            return [
              `ROI: ${item.formattedValue}%`,
              `Margen: $${strategy?.margen || 0}/ha`,
              `Rendimiento: ${strategy?.rendimiento || 0} t/ha`
            ];
          }
        }
      }
    },
    scales: {
      y: {
        grid: { 
          display: true,
          color: isLightTheme ? 'rgba(51, 65, 85, 0.25)' : 'rgba(255, 255, 255, 0.18)',
          lineWidth: 1.5
        },
        border: { display: true, color: borderColor, width: 2 },
        ticks: {
          color: textColor,
          font: { size: 14, weight: '800' }
        }
      },
      xROI: {
        type: 'linear',
        position: 'bottom',
        title: {
          display: true,
          text: 'ROI (%)',
          color: textColor,
          font: { size: 14, weight: '800' }
        },
        grid: { color: gridColor, lineWidth: 1.5 },
        border: { display: true, color: borderColor, width: 2 },
        ticks: { color: tickColor, font: { size: 13, weight: '800' } }
      }
    }
  };

  return (
    <div className="financial-roi chart-wrapper" style={{ height: '100%', minHeight: '340px', width: '100%' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
