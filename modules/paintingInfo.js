// Display painting info in the DOM
// If the description exceeds a character threshold, the container widens so
// long text has more breathing room.
const WIDE_THRESHOLD = 400;

export const displayPaintingInfo = (info) => {
  const infoElement = document.getElementById('painting-info'); // Get the reference

  // Set the html content inside info element
  infoElement.innerHTML = `
    <h3>${info.title}</h3>
    <p><strong>Artist:</strong> ${info.artist}</p>
    ${info.date ? `<p><strong>Date:</strong> ${info.date}</p>` : ''}
    ${info.medium ? `<p><strong>Medium:</strong> ${info.medium}</p>` : ''}
    ${info.dimension ? `<p><strong>Dimension:</strong> ${info.dimension}</p>` : ''}
    <p><strong>Description:</strong> ${info.description}</p>
  `;

  // Toggle wider layout for long descriptions
  const desc = info.description ?? '';
  infoElement.classList.toggle('wide', desc.length > WIDE_THRESHOLD);

  infoElement.classList.add('show'); // Add the 'show' class
};

// Hide painting info in the DOM
export const hidePaintingInfo = () => {
  const infoElement = document.getElementById('painting-info'); // Get the reference
  infoElement.classList.remove('show'); // Remove the 'show' class
};

