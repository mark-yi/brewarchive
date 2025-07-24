import { useState } from 'react';
import './App.css';

function Bulk() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [csvData, setCsvData] = useState(null);

  const getBulkData = async () => {
    setIsLoading(true);
    setCsvData(null);
    setProgress(0);

    const eventSource = new EventSource('http://localhost:3001/bulk-scrape');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.progress) {
        setProgress(data.progress);
      }
      if (data.csv) {
        setCsvData(data.csv);
        setIsLoading(false);
        eventSource.close();
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource failed:', error);
      setIsLoading(false);
      eventSource.close();
    };
  };

  const downloadCsv = () => {
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'brew-newsletters.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Bulk Scrape</h1>
        <button onClick={getBulkData} disabled={isLoading}>
          {isLoading ? `Scraping... ${progress}%` : 'Scrape All Brews'}
        </button>
        {csvData && (
          <button onClick={downloadCsv}>
            Download CSV
          </button>
        )}
      </header>
      <main>
        {isLoading && (
          <div>
            <p>Scraping in progress, please wait...</p>
            <progress value={progress} max="100" />
          </div>
        )}
      </main>
    </div>
  );
}

export default Bulk;
