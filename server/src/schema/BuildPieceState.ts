import { Schema, type } from '@colyseus/schema';

export class BuildPieceState extends Schema {
  @type('string') id = '';
  @type('string') buildType = '';
  @type('number') gx = 0;
  @type('number') gy = 0;
  @type('number') gz = 0;
  @type('string') face = '';
  @type('string') rampDir = '';
  @type('number') hp = 150;
  @type('string') ownerId = '';
}
