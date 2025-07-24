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
  const [currentBrewType, setCurrentBrewType] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const getNewsletter = async () => {
    setIsLoading(true); // Start loading
    setNewsletter(null); // Clear previous newsletter
    setDaysAgo(null); // Clear previous daysAgo
    setCurrentBrewType(null); // Clear previous brewType

    const randomDaysAgo = Math.floor(Math.random() * 10) + 1; // Random between 1 and 10
    const randomBrewIndex = Math.floor(Math.random() * BREW_TYPES.length);
    const selectedBrew = BREW_TYPES[randomBrewIndex].value;

    setDaysAgo(randomDaysAgo);
    setCurrentBrewType(selectedBrew);

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
    } finally {
      setIsLoading(false); // End loading
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Morning Brew Archive</h1>
        <button onClick={getNewsletter} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Get New Newsletter'}
        </button>
        {daysAgo !== null && currentBrewType !== null && (
          <p>Newsletter from {daysAgo} days ago from {BREW_TYPES.find(b => b.value === currentBrewType)?.label || currentBrewType}.</p>
        )}
      </header>
      <main>
        {isLoading ? (
          <p>Scraping in progress, please wait...</p>
        ) : newsletter ? (
          <div className="newsletter-content" dangerouslySetInnerHTML={{ __html: newsletter }} />
        ) : (
          <p>Click the button to get a newsletter.</p>
        )}
      </main>
    </div>
  );
}

export default App;
