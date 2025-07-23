import { useState } from 'react';
import './App.css';

const BREW_TYPES = [
  { value: 'brewmarkets', label: 'Brew Markets' },
  { value: 'cfobrew', label: 'CFO Brew' },
  { value: 'healthcare-brew', label: 'Healthcare Brew' },
  { value: 'hr-brew', label: 'HR Brew' },
  { value: 'itbrew', label: 'IT Brew' },
  { value: 'marketingbrew', label: 'Marketing Brew' },
  { value: 'retailbrew', label: 'Retail Brew' },
  { value: 'emergingtechbrew', label: 'Emerging Tech Brew' },
  { value: 'morningbrew', label: 'Morning Brew' },
];

function App() {
  const [newsletter, setNewsletter] = useState(null);
  const [daysAgo, setDaysAgo] = useState(null);
  const [selectedBrew, setSelectedBrew] = useState(BREW_TYPES[0].value);

  const getNewsletter = async () => {
    const randomDaysAgo = Math.floor(Math.random() * 365) + 1;
    setDaysAgo(randomDaysAgo);
    try {
      const response = await fetch(`http://localhost:3001/newsletter?daysAgo=${randomDaysAgo}&brewType=${selectedBrew}`);
      const data = await response.json();
      if (response.ok) {
        setNewsletter(data.html);
      } else {
        setNewsletter(`<p>Error: ${data.error}</p>`);
      }
    } catch (error) {
      setNewsletter(`<p>Error fetching newsletter: ${error.message}</p>`);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Morning Brew Archive</h1>
        <select value={selectedBrew} onChange={(e) => setSelectedBrew(e.target.value)}>
          {BREW_TYPES.map((brew) => (
            <option key={brew.value} value={brew.value}>
              {brew.label}
            </option>
          ))}
        </select>
        <button onClick={getNewsletter}>Get New Newsletter</button>
        {daysAgo !== null && <p>Newsletter from {daysAgo} days ago ({selectedBrew}).</p>}
      </header>
      <main>
        {newsletter ? (
          <div className="newsletter-content" dangerouslySetInnerHTML={{ __html: newsletter }} />
        ) : (
          <p>Click the button to get a newsletter.</p>
        )}
      </main>
    </div>
  );
}

export default App;
