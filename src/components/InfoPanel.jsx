import React from 'react';

function InfoPanel({ isVisible, setIsVisible, controlType }) {
  return (
    <div id="info-panel">
      <div id="info-header">
        <h3>Controls</h3>
        <button id="toggle-info" onClick={() => setIsVisible(!isVisible)}>
          {isVisible ? 'HIDE' : 'SHOW'}
        </button>
      </div>
      {isVisible && (
        <div id="info-content">
          {controlType === 'mobile' ? (
            <>
              <p>Tap floor: Move to location</p>
              <p>Swipe: Look around</p>
              <p>Tap painting: View artwork info</p>
              <p>Tap item (bottom-right): Interact</p>
              <p>Two-finger tap: Switch item</p>
              <p>Menu button (bottom-left): Open menu</p>
            </>
          ) : (
            <>
              <p>W/A/S/D: Move around</p>
              <p>Mouse: Look around</p>
              <p>Mouse Wheel: Change items</p>
              <p>Left Click: Open artwork link</p>
              <p>Right Click: Interact with item</p>
              <p>Space: Toggle pointer lock</p>
              <p>M: Show Menu</p>
              <p>Enter: Start exploration</p>
              <p>Esc: Stop exploration</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default InfoPanel;

