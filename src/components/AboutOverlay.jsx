import React, { useEffect, useState } from 'react';

const SHOW_JSON_URL = 'artworks/currentShow.json';

function AboutOverlay({ onClose }) {
  const [about, setAbout] = useState(null);

  useEffect(() => {
    fetch(SHOW_JSON_URL)
      .then((r) => r.json())
      .then((d) => setAbout(d.about ?? null))
      .catch(() => setAbout(null));
  }, []);

  return (
    <div id="about-overlay" className="show">
      <button type="button" id="close-about" onClick={onClose}>X</button>
      {!about ? (
        <p>Loading…</p>
      ) : (
        <>
          <h1>{about.heading}</h1>
          <p>{about.introParagraph}</p>
          <p>
            <strong>{about.pressReleaseHeading}</strong>
          </p>
          {about.pressParagraphs?.map((html, i) => (
            <p key={i} dangerouslySetInnerHTML={{ __html: html }} />
          ))}
          <p>{about.artistsLine}</p>
          {/* <p>
            <a href="https://www.artsy.net/show/a-space-gallery-liminal-lucid" target="_blank" rel="noopener noreferrer">View on Artsy</a>
          </p> */}
          <p>
            {about.socialLinks?.map((link, i) => (
              <React.Fragment key={link.href}>
                {i > 0 && <br />}
                <a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
              </React.Fragment>
            ))}
          </p>
        </>
      )}
    </div>
  );
}

export default AboutOverlay;
