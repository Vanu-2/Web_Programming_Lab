// Fetch the candidate count and voter count from the backend and update the HTML
Promise.all([
    fetch('/api/candidateCount').then(response => response.json()),
    fetch('/api/voterCount').then(response => response.json())
  ])
    .then(([candidateData, voterData]) => {
      document.getElementById('candidateCount').textContent = candidateData.count;
      document.getElementById('voterCount').textContent = voterData.count; // This should work if the ID matches
    })
    .catch(error => {
      console.error('Error fetching counts:', error);
      document.getElementById('candidateCount').textContent = 'Error';
      document.getElementById('voterCount').textContent = 'Error'; // Handle error for voter count
    });
  