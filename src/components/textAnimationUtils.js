// src/components/textAnimationUtils.js
import * as THREE from 'three';

// ... (computeFaceCentroid and fibSpherePoint remain the same) ...
export function computeFaceCentroid(geometry, faceIndex) {
  const positionAttribute = geometry.attributes.position;
  const indexAttribute = geometry.index; // This might be null
  const centroid = new THREE.Vector3();

  if (indexAttribute) { // Indexed geometry
    const ia = indexAttribute.getX(faceIndex * 3);
    const ib = indexAttribute.getX(faceIndex * 3 + 1);
    const ic = indexAttribute.getX(faceIndex * 3 + 2);

    const va = new THREE.Vector3().fromBufferAttribute(positionAttribute, ia);
    const vb = new THREE.Vector3().fromBufferAttribute(positionAttribute, ib);
    const vc = new THREE.Vector3().fromBufferAttribute(positionAttribute, ic);
    centroid.add(va).add(vb).add(vc).divideScalar(3);
  } else { // Non-indexed geometry (assume vertices are sequential for faces)
    const vOffset = faceIndex * 3; // 3 vertices per face
    const va = new THREE.Vector3().fromBufferAttribute(positionAttribute, vOffset + 0);
    const vb = new THREE.Vector3().fromBufferAttribute(positionAttribute, vOffset + 1);
    const vc = new THREE.Vector3().fromBufferAttribute(positionAttribute, vOffset + 2);
    centroid.add(va).add(vb).add(vc).divideScalar(3);
  }
  return centroid;
}

export function fibSpherePoint(i, n, radius) {
  const v = new THREE.Vector3();
  const G_FIB = Math.PI * (3 - Math.sqrt(5));
  const step = 2.0 / n;
  v.y = i * step - 1 + (step * 0.5);
  const r = Math.sqrt(1 - v.y * v.y);
  const phi = i * G_FIB;
  v.x = Math.cos(phi) * r;
  v.z = Math.sin(phi) * r;
  v.x *= radius;
  v.y *= radius;
  v.z *= radius;
  return v;
}


export function separateFaces(geometry) {
  const posAttr = geometry.attributes.position;
  const normalAttr = geometry.attributes.normal;
  const uvAttr = geometry.attributes.uv;
  const indexAttr = geometry.index;

  const newPositions = [];
  const newNormals = normalAttr ? [] : null;
  const newUvs = uvAttr ? [] : null;

  if (indexAttr) { // Handle indexed geometry
    console.log("Separating faces from INDEXED geometry");
    for (let i = 0; i < indexAttr.count; i++) {
      const ndx = indexAttr.getX(i);
      newPositions.push(posAttr.getX(ndx), posAttr.getY(ndx), posAttr.getZ(ndx));
      if (newNormals) {
        newNormals.push(normalAttr.getX(ndx), normalAttr.getY(ndx), normalAttr.getZ(ndx));
      }
      if (newUvs) {
        newUvs.push(uvAttr.getX(ndx), uvAttr.getY(ndx));
      }
    }
  } else { // Handle NON-INDEXED geometry (assume vertices are ordered per triangle)
    console.log("Separating faces from NON-INDEXED geometry (duplicating vertices)");
    if (posAttr.count % 3 !== 0) {
        console.error("Non-indexed geometry position count is not a multiple of 3. Cannot process.");
        return geometry; // Or throw an error
    }
    for (let i = 0; i < posAttr.count; i++) {
        // Simply copy existing vertices as they are already unique per face in this case
        newPositions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        if (newNormals && normalAttr) {
            newNormals.push(normalAttr.getX(i), normalAttr.getY(i), normalAttr.getZ(i));
        }
        if (newUvs && uvAttr) {
            newUvs.push(uvAttr.getX(i), uvAttr.getY(i));
        }
    }
  }

  if (newPositions.length === 0) {
    console.error("Separation resulted in no positions.");
    return geometry; // Return original if something went wrong
  }

  const newGeometry = new THREE.BufferGeometry();
  newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  if (newNormals && newNormals.length > 0) {
    newGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(newNormals, 3));
  }
  if (newUvs && newUvs.length > 0) {
    newGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(newUvs, 2));
  }
  // The new geometry is now non-indexed by definition of this function's purpose.
  return newGeometry;
}