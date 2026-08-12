import React, { useEffect, useState } from 'react';

// Small HUD element under the FPS counter showing which room the camera is
// currently inside, or "Between Room X and Room Y" when it's in the corridor
// connecting two rooms.
function LocationDisplay({ camera, rooms, doorways }) {
  const [label, setLabel] = useState('Room 1');

  useEffect(() => {
    if (!camera || !rooms || rooms.length === 0) return;

    const roomNumber = (id) =>
      id === 'main' ? 1 : parseInt(String(id).replace('room', ''), 10);

    const containsXZ = (r, x, z) => {
      const halfW = r.width / 2;
      const halfD = r.depth / 2;
      return (
        x >= r.position.x - halfW && x <= r.position.x + halfW &&
        z >= r.position.z - halfD && z <= r.position.z + halfD
      );
    };

    // Axis-aligned corridor rectangle between two adjacent rooms.
    const corridorRect = (a, b) => {
      const a1X = a.position.x - a.width / 2, a2X = a.position.x + a.width / 2;
      const b1X = b.position.x - b.width / 2, b2X = b.position.x + b.width / 2;
      const a1Z = a.position.z - a.depth / 2, a2Z = a.position.z + a.depth / 2;
      const b1Z = b.position.z - b.depth / 2, b2Z = b.position.z + b.depth / 2;
      if (b1X >= a2X) return { minX: a2X, maxX: b1X, minZ: Math.max(a1Z, b1Z), maxZ: Math.min(a2Z, b2Z) };
      if (a1X >= b2X) return { minX: b2X, maxX: a1X, minZ: Math.max(a1Z, b1Z), maxZ: Math.min(a2Z, b2Z) };
      if (b1Z >= a2Z) return { minX: Math.max(a1X, b1X), maxX: Math.min(a2X, b2X), minZ: a2Z, maxZ: b1Z };
      if (a1Z >= b2Z) return { minX: Math.max(a1X, b1X), maxX: Math.min(a2X, b2X), minZ: b2Z, maxZ: a1Z };
      return null;
    };

    const byId = {};
    rooms.forEach((r) => { byId[r.id] = r; });
    const doors = doorways || [];

    const update = () => {
      const cx = camera.position.x;
      const cz = camera.position.z;

      for (const r of rooms) {
        if (containsXZ(r, cx, cz)) {
          setLabel(`Room ${roomNumber(r.id)}`);
          return;
        }
      }

      for (const d of doors) {
        const r1 = byId[d.room1];
        const r2 = byId[d.room2];
        if (!r1 || !r2) continue;
        const rect = corridorRect(r1, r2);
        if (!rect) continue;
        if (cx >= rect.minX && cx <= rect.maxX && cz >= rect.minZ && cz <= rect.maxZ) {
          const nums = [roomNumber(r1.id), roomNumber(r2.id)].sort((a, b) => a - b);
          setLabel(`Between Room ${nums[0]} and Room ${nums[1]}`);
          return;
        }
      }
      // No match — leave the previous label untouched.
    };

    update();
    const iv = setInterval(update, 200);
    return () => clearInterval(iv);
  }, [camera, rooms, doorways]);

  return <div id="location-display">{label}</div>;
}

export default LocationDisplay;
