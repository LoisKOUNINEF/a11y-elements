// Re-exported from every overlay's `define.ts` so zero-build `<script type="module">` users can reach them too.
export * from '../../core/zero-build-exports.js';
export { dismissAllOverlays, removeOverlaysWithin } from '../../core/overlay-registry.js';
