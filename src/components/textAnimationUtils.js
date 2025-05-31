// src/components/textAnimationUtils.js (ensure this file exists and is correctly imported)
import *
as THREE from 'three';

// Computes the centroid of a face in a BufferGeometry.
// Assumes `geometry.attributes.position` exists.
// `faceIndex` is the index of the face (0, 1, 2, ...).
export const computeFaceCentroid = (geometry, faceIndex) => {
    const positionAttribute = geometry.attributes.position;
    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const vC = new THREE.Vector3();

    const iA = faceIndex * 3;
    const iB = faceIndex * 3 + 1;
    const iC = faceIndex * 3 + 2;

    vA.fromBufferAttribute(positionAttribute, iA);
    vB.fromBufferAttribute(positionAttribute, iB);
    vC.fromBufferAttribute(positionAttribute, iC);

    const centroid = new THREE.Vector3();
    centroid.add(vA).add(vB).add(vC).divideScalar(3);
    return centroid;
};


// Separates faces of a BufferGeometry.
// Creates a new BufferGeometry where each triangle has unique vertices.
export const separateFaces = (geometry) => {
    if (!geometry.index) { // Non-indexed geometry
        // If already non-indexed and we want to ensure attributes are per-face-vertex
        // we might need to re-construct. For now, assume it's either indexed or already suitable.
        // A simple clone might work if it's already structured correctly per face.
        // However, true separation means each triangle's vertices are unique in the arrays.
        
        // Fallback for non-indexed: just clone attributes and hope for the best, or implement full separation.
        // This part is complex for arbitrary non-indexed geometries if they share vertices implicitly.
        // Most TextGeometries are non-indexed but vertices are typically unique per face already.
        console.warn("separateFaces: Attempting to process non-indexed geometry. Normals might be an issue if not already face-like.");
         const newGeometry = new THREE.BufferGeometry();
         newGeometry.setAttribute('position', geometry.attributes.position.clone());
         if (geometry.attributes.normal) newGeometry.setAttribute('normal', geometry.attributes.normal.clone());
         if (geometry.attributes.uv) newGeometry.setAttribute('uv', geometry.attributes.uv.clone());
         return newGeometry; // This is a simplification
    }

    const newPosition = [];
    const newNormal = [];
    const newUv = [];

    const positionAttr = geometry.attributes.position;
    const normalAttr = geometry.attributes.normal;
    const uvAttr = geometry.attributes.uv;
    const indexAttr = geometry.index;

    for (let i = 0; i < indexAttr.count; i++) {
        const idx = indexAttr.getX(i);
        newPosition.push(positionAttr.getX(idx), positionAttr.getY(idx), positionAttr.getZ(idx));
        if (normalAttr) {
            newNormal.push(normalAttr.getX(idx), normalAttr.getY(idx), normalAttr.getZ(idx));
        }
        if (uvAttr) {
            newUv.push(uvAttr.getX(idx), uvAttr.getY(idx));
        }
    }

    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPosition, 3));
    if (newNormal.length > 0) {
        newGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(newNormal, 3));
    }
    if (newUv.length > 0) {
        newGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(newUv, 2));
    }
    
    // If normals weren't separated properly or didn't exist, compute flat normals
    if (newNormal.length === 0 || newNormal.length !== newPosition.length) {
        newGeometry.computeVertexNormals(); // This will compute smoothed normals.
                                          // For flat shading, normals should be per-face.
                                          // After separating faces, computeVertexNormals *should* give flat-like normals
                                          // because vertices are no longer shared between faces with different orientations.
    }
    return newGeometry;
};