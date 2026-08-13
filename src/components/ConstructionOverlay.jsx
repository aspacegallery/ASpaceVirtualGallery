import React, { useEffect, useState } from 'react';

const SHOW_JSON_URL = 'artworks/currentShow.json';

function ConstructionOverlay() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    fetch(SHOW_JSON_URL)
      .then((r) => r.json())
      .then((d) => {
        const end = d?.date?.end;
        if (!end) return;
        const endDate = new Date(end);
        if (Number.isNaN(endDate.getTime())) return;
        if (new Date() > endDate) setShow(true);
      })
      .catch(() => {});
  }, []);

  if (!show) return null;

  return (
    <div id="construction-overlay">
      <p>A Space Virtual Gallery is under construction...</p>
      <p>
        <a href="https://aspacevirtualarchive.vercel.app/" target="_blank" rel="noopener noreferrer">
          Visit A Space Virtual Archive to see artists selected from our past exhibitions
        </a>
      </p>
    </div>
  );
}

export default ConstructionOverlay;
