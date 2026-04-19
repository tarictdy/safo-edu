import { runAction } from '../engine/actionEngine.js';

export function tiltSelectedItem() {
  return runAction('tilt');
}
