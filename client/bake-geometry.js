// Bake a model's own placement into its geometry, for drawing many copies as
// one InstancedMesh. The kits' normals are packed into bytes (gltf-transform
// quantize); transformed in place they round to nothing, and a normal of no
// length lights to NaN, which draws black whatever the light. So the normals
// are first made unit-length floats, then the matrix is applied.
export function bakeGeometry(geometry, matrix) {
  const geo = geometry.clone();
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const n = geo.attributes.normal, out = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const x = n.getX(i), y = n.getY(i), z = n.getZ(i), L = Math.hypot(x, y, z);
    if (L > 1e-6) { out[i * 3] = x / L; out[i * 3 + 1] = y / L; out[i * 3 + 2] = z / L; } else out[i * 3 + 1] = 1;
  }
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(out, 3));
  if (matrix) geo.applyMatrix4(matrix);
  return geo;
}
