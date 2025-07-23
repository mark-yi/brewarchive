import { useState } from 'react';
import './App.css';

function App() {
  const [newsletter, setNewsletter] = useState(null);
  const [daysAgo, setDaysAgo] = useState(null);

  const getNewsletter = async () => {
    const randomDaysAgo = Math.floor(Math.random() * 365) + 1;
    setDaysAgo(randomDaysAgo);
    try {
      const response = await fetch(`http://localhost:3001/newsletter?daysAgo=${randomDaysAgo}`);
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
        <button onClick={getNewsletter}>Get New Newsletter</button>
        {daysAgo !== null && <p>Newsletter from {daysAgo} days ago.</p>}
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
