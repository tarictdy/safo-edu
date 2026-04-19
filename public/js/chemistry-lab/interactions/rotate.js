import { runAction } from '../engine/actionEngine.js';

export function rotateSelectedItem() {
  return runAction('rotate');
}
